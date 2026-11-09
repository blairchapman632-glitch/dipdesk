import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUserIdFromRequest } from '@/lib/googleOAuthState'
import { getGoogleConnection, saveGoogleTokens } from '@/lib/googleConnections'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Tokens come from the server-only google_connections table (not profiles)
async function getValidAccessToken(userId: string): Promise<string | null> {
  const c = await getGoogleConnection(userId)
  if (!c) return null

  if (c.access_token && c.token_expiry && Date.now() < c.token_expiry - 60000) {
    return c.access_token
  }

  if (!c.refresh_token) return null

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: c.refresh_token,
      grant_type: 'refresh_token',
    }),
  })

  const data = await res.json().catch(() => ({}))
  if (!data.access_token) return null

  await saveGoogleTokens(userId, {
    access_token: data.access_token,
    token_expiry: Date.now() + (data.expires_in || 3600) * 1000,
  })

  return data.access_token
}

function extractSheetId(url: string): string | null {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  return match ? match[1] : null
}

const SHEET_TAB = 'Unicorn'

type GoogleResult = { ok: boolean; status: number; data: any }

// Every Google API call goes through here so failures are never silent.
async function googleCall(url: string, accessToken: string, init: RequestInit = {}): Promise<GoogleResult> {
  try {
    const res = await fetch(url, {
      ...init,
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
    })
    const data = await res.json().catch(() => null)
    return { ok: res.ok, status: res.status, data }
  } catch {
    return { ok: false, status: 0, data: null }
  }
}

class SyncError extends Error {
  constructor(public step: string, public result: GoogleResult) {
    super(step)
  }
}

function failure(err: SyncError) {
  const { step, result } = err
  if (result.status === 401) {
    return NextResponse.json(
      { error: 'not_connected', message: 'Google connection expired — please reconnect Google Sheets.' },
      { status: 401 }
    )
  }
  const reason =
    result.status === 0 ? 'could not reach Google' :
    result.status === 403 ? 'Google denied access' :
    result.status === 404 ? 'sheet not found' :
    result.status === 429 ? 'Google is busy, try again in a minute' :
    `Google error ${result.status}`
  return NextResponse.json({ error: 'sync_failed', message: `Sync failed while ${step}: ${reason}.` }, { status: 502 })
}

function must(result: GoogleResult, step: string): GoogleResult {
  if (!result.ok) throw new SyncError(step, result)
  return result
}

// Creates a new app-owned sheet, saves its link to the dip, and shares it view-only.
// Returns the spreadsheet id and the tab id of the Unicorn tab.
async function createAppSheet(accessToken: string, dipId: string, title: string) {
  const created = must(
    await googleCall('https://sheets.googleapis.com/v4/spreadsheets', accessToken, {
      method: 'POST',
      body: JSON.stringify({ properties: { title }, sheets: [{ properties: { title: SHEET_TAB } }] }),
    }),
    'creating the sheet'
  ).data
  const sheetId: string | undefined = created?.spreadsheetId
  if (!sheetId) throw new SyncError('creating the sheet', { ok: false, status: 500, data: created })

  // Save straight away so a later failure doesn't leave an orphan sheet behind
  const sheetUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/edit`
  const { error } = await supabase.from('dips').update({ google_sheet_link: sheetUrl } as any).eq('id', dipId)
  if (error) throw new SyncError('saving the sheet link', { ok: false, status: 500, data: error })

  must(
    await googleCall(`https://www.googleapis.com/drive/v3/files/${sheetId}/permissions`, accessToken, {
      method: 'POST',
      body: JSON.stringify({ role: 'reader', type: 'anyone' }),
    }),
    'sharing the sheet'
  )

  const tabId: number = created.sheets?.[0]?.properties?.sheetId ?? 0
  return { sheetId, tabId }
}

export async function POST(request: NextRequest) {
  const userId = await getUserIdFromRequest(request, supabase)
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized', message: 'Please log in again.' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const dipId = body?.dipId
  if (!dipId || typeof dipId !== 'string') {
    return NextResponse.json({ error: 'bad_request', message: 'Missing dip.' }, { status: 400 })
  }

  const [{ data: dip }, { data: spotsRaw }, { data: profile }] = await Promise.all([
    supabase.from('dips').select('*').eq('id', dipId).single(),
    supabase.from('spots').select('*').eq('dip_id', dipId).order('spot_number', { ascending: true }),
    supabase.from('profiles').select('role').eq('id', userId).single(),
  ])

  if (!dip) return NextResponse.json({ error: 'not_found', message: 'Dip not found.' }, { status: 404 })

  const isOwner = String(dip.user_id) === String(userId)
  const isAdmin = (profile as any)?.role === 'super_admin'
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: 'forbidden', message: "You can't sync this dip." }, { status: 403 })
  }

  const accessToken = await getValidAccessToken(userId)
  if (!accessToken) {
    return NextResponse.json(
      { error: 'not_connected', message: 'Connect Google Sheets first.' },
      { status: 401 }
    )
  }

  const spots = (spotsRaw || []) as any[]
  const showPaymentCols = true
  const totalSpots = dip.total_spots
  const filledCount = spots.filter((s: any) => s.player_name).length
  const dipsRemaining = totalSpots - filledCount

  // Type label helper
  const typeLabel: Record<string, string> = {
    main: 'Main', ls1: 'LS 1', ls2: 'LS 2', ls3: 'LS 3', ls4: 'LS 4', ls5: 'LS 5',
    bookend: 'Bookend', closing: 'Closing Special',
  }

  // Main spot list — one row per spot number 1 to total
  const spotRows: any[][] = []
  for (let i = 1; i <= totalSpots; i++) {
    const spot = spots.find((s: any) => s.spot_number === i)
    const isGameSpot = spot?.spot_type?.startsWith('game:') || spot?.spot_type === 'game'
    const gameEmoji = spot?.spot_type?.startsWith('game:') ? spot.spot_type.replace('game:', '') : null
    spotRows.push([
      i,
      spot?.player_name || '',
      isGameSpot ? (gameEmoji ? `🎮 ${gameEmoji}` : '🎮 Game') : (spot ? (typeLabel[spot.spot_type] || spot.spot_type) : ''),
    ])
  }

  // Player totals — one row per player, total owed
  const playerTotals: Record<string, { name: string; totalOwed: number; allPaid: boolean }> = {}
  for (const spot of spots) {
    if (!spot.player_name) continue
    if (!playerTotals[spot.player_name]) {
      playerTotals[spot.player_name] = { name: spot.player_name, totalOwed: 0, allPaid: true }
    }
    if (spot.amount_owed !== null) {
      playerTotals[spot.player_name].totalOwed += spot.amount_owed
    }
    if (!spot.paid) playerTotals[spot.player_name].allPaid = false
  }
  const playerRows = Object.values(playerTotals)

  try {
    // Use the existing sheet if the app can open it; otherwise make a fresh app-owned one.
    // 403/404 = not ours (e.g. an old pasted link, or deleted). A sheet without our
    // Unicorn tab was never created by the app, so we replace that too.
    let sheetId: string | null = dip.google_sheet_link ? extractSheetId(dip.google_sheet_link) : null
    let sheetTabId = 0

    if (sheetId) {
      const meta = await googleCall(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties`,
        accessToken
      )
      if (meta.status === 403 || meta.status === 404) {
        sheetId = null
      } else {
        must(meta, 'opening the sheet')
        const tab = (meta.data?.sheets || []).find((s: any) => s?.properties?.title === SHEET_TAB)
        if (tab) sheetTabId = tab.properties.sheetId ?? 0
        else sheetId = null
      }
    }

    if (!sheetId) {
      const created = await createAppSheet(accessToken, dipId, dip.title)
      sheetId = created.sheetId
      sheetTabId = created.tabId
    }

    // Clear sheet
    must(
      await googleCall(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${SHEET_TAB}!A1:Z2000:clear`,
        accessToken,
        { method: 'POST', body: '{}' }
      ),
      'clearing the sheet'
    )

    // Build values
    const values: any[][] = []

    // Row 1: stats
    values.push(['Dips Remaining', dipsRemaining, '', '', 'Total Number of Dips', totalSpots])

    // Row 2: blank gap row
    values.push(['', '', '', '', '', ''])

    // Row 3: main table header + optional payment summary header
    const row3 = ['#', 'Name', 'Type', '']
    if (showPaymentCols) row3.push('Player', 'Total Owed (USD)', 'Paid')
    values.push(row3)

    // Data rows
    const maxRows = Math.max(spotRows.length, showPaymentCols ? playerRows.length : 0)
    for (let i = 0; i < maxRows; i++) {
      const left = spotRows[i] || ['', '', '']
      const row = [...left, '']
      if (showPaymentCols) {
        const p = playerRows[i]
        row.push(
          p?.name || '',
          p ? (p.totalOwed === 0 ? '' : `$${p.totalOwed}`) : '',
          p ? (p.allPaid ? 'Yes' : 'No') : '',
        )
      }
      values.push(row)
    }

    // Write values
    must(
      await googleCall(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${SHEET_TAB}!A1?valueInputOption=RAW`,
        accessToken,
        { method: 'PUT', body: JSON.stringify({ values }) }
      ),
      'writing the spot list'
    )

    // Formatting
    const totalRows = values.length
    const formatRequests: any[] = [
      // Pink background for main spot list (A:C)
      {
        repeatCell: {
          range: { sheetId: sheetTabId, startRowIndex: 0, endRowIndex: totalRows, startColumnIndex: 0, endColumnIndex: 3 },
          cell: { userEnteredFormat: { backgroundColor: { red: 0.98, green: 0.88, blue: 0.93 } } },
          fields: 'userEnteredFormat.backgroundColor',
        },
      },
      // Row 1 — bold, larger font, centered
      {
        repeatCell: {
          range: { sheetId: sheetTabId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 6 },
          cell: {
            userEnteredFormat: {
              textFormat: { bold: true, fontSize: 11 },
              horizontalAlignment: 'CENTER',
              verticalAlignment: 'MIDDLE',
            },
          },
          fields: 'userEnteredFormat.textFormat,userEnteredFormat.horizontalAlignment,userEnteredFormat.verticalAlignment',
        },
      },
      // Row 2 — blank gap row, taller
      {
        updateDimensionProperties: {
          range: { sheetId: sheetTabId, dimension: 'ROWS', startIndex: 1, endIndex: 2 },
          properties: { pixelSize: 8 },
          fields: 'pixelSize',
        },
      },
      // Header row (row 3) — bold, larger, centered, dark background
      {
        repeatCell: {
          range: { sheetId: sheetTabId, startRowIndex: 2, endRowIndex: 3, startColumnIndex: 0, endColumnIndex: showPaymentCols ? 7 : 3 },
          cell: {
            userEnteredFormat: {
              textFormat: { bold: true, fontSize: 11, foregroundColor: { red: 1, green: 1, blue: 1 } },
              backgroundColor: { red: 0.76, green: 0.23, blue: 0.42 },
              horizontalAlignment: 'CENTER',
              verticalAlignment: 'MIDDLE',
            },
          },
          fields: 'userEnteredFormat.textFormat,userEnteredFormat.backgroundColor,userEnteredFormat.horizontalAlignment,userEnteredFormat.verticalAlignment',
        },
      },
      // Data rows — centered, medium font
      {
        repeatCell: {
          range: { sheetId: sheetTabId, startRowIndex: 3, endRowIndex: totalRows, startColumnIndex: 0, endColumnIndex: showPaymentCols ? 7 : 3 },
          cell: {
            userEnteredFormat: {
              horizontalAlignment: 'CENTER',
              verticalAlignment: 'MIDDLE',
              textFormat: { fontSize: 10 },
            },
          },
          fields: 'userEnteredFormat.horizontalAlignment,userEnteredFormat.verticalAlignment,userEnteredFormat.textFormat',
        },
      },
      // Name column (B) — left align
      {
        repeatCell: {
          range: { sheetId: sheetTabId, startRowIndex: 3, endRowIndex: totalRows, startColumnIndex: 1, endColumnIndex: 2 },
          cell: { userEnteredFormat: { horizontalAlignment: 'LEFT' } },
          fields: 'userEnteredFormat.horizontalAlignment',
        },
      },
      // Set minimum column widths
      {
        updateDimensionProperties: {
          range: { sheetId: sheetTabId, dimension: 'COLUMNS', startIndex: 0, endIndex: 1 },
          properties: { pixelSize: 150 },
          fields: 'pixelSize',
        },
      },
      {
        updateDimensionProperties: {
          range: { sheetId: sheetTabId, dimension: 'COLUMNS', startIndex: 1, endIndex: 2 },
          properties: { pixelSize: 220 },
          fields: 'pixelSize',
        },
      },
      {
        updateDimensionProperties: {
          range: { sheetId: sheetTabId, dimension: 'COLUMNS', startIndex: 2, endIndex: 3 },
          properties: { pixelSize: 130 },
          fields: 'pixelSize',
        },
      },
      {
        updateDimensionProperties: {
          range: { sheetId: sheetTabId, dimension: 'COLUMNS', startIndex: 4, endIndex: 5 },
          properties: { pixelSize: 220 },
          fields: 'pixelSize',
        },
      },
      // Row height for data rows
      {
        updateDimensionProperties: {
          range: { sheetId: sheetTabId, dimension: 'ROWS', startIndex: 2, endIndex: totalRows },
          properties: { pixelSize: 28 },
          fields: 'pixelSize',
        },
      },
    ]

    // Blue background + formatting for payment summary (E:G) if visible
    if (showPaymentCols) {
      formatRequests.push(
        {
          repeatCell: {
            range: { sheetId: sheetTabId, startRowIndex: 0, endRowIndex: totalRows, startColumnIndex: 4, endColumnIndex: 7 },
            cell: { userEnteredFormat: { backgroundColor: { red: 0.84, green: 0.91, blue: 0.97 } } },
            fields: 'userEnteredFormat.backgroundColor',
          },
        },
        {
          repeatCell: {
            range: { sheetId: sheetTabId, startRowIndex: 2, endRowIndex: 3, startColumnIndex: 4, endColumnIndex: 7 },
            cell: {
              userEnteredFormat: {
                textFormat: { bold: true, fontSize: 11, foregroundColor: { red: 1, green: 1, blue: 1 } },
                backgroundColor: { red: 0.24, green: 0.52, blue: 0.78 },
                horizontalAlignment: 'CENTER',
              },
            },
            fields: 'userEnteredFormat.textFormat,userEnteredFormat.backgroundColor,userEnteredFormat.horizontalAlignment',
          },
        },
        {
          updateDimensionProperties: {
            range: { sheetId: sheetTabId, dimension: 'COLUMNS', startIndex: 4, endIndex: 5 },
            properties: { pixelSize: 200 },
            fields: 'pixelSize',
          },
        },
        {
          updateDimensionProperties: {
            range: { sheetId: sheetTabId, dimension: 'COLUMNS', startIndex: 5, endIndex: 6 },
            properties: { pixelSize: 140 },
            fields: 'pixelSize',
          },
        },
        {
          updateDimensionProperties: {
            range: { sheetId: sheetTabId, dimension: 'COLUMNS', startIndex: 6, endIndex: 7 },
            properties: { pixelSize: 80 },
            fields: 'pixelSize',
          },
        },
      )
    }

    must(
      await googleCall(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`,
        accessToken,
        { method: 'POST', body: JSON.stringify({ requests: formatRequests }) }
      ),
      'formatting the sheet'
    )

    return NextResponse.json({ success: true, sheetId })
  } catch (err) {
    if (err instanceof SyncError) return failure(err)
    return NextResponse.json({ error: 'sync_failed', message: 'Sync failed — try again.' }, { status: 500 })
  }
}

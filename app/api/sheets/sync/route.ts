import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function getValidAccessToken(userId: string): Promise<string | null> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('google_access_token, google_refresh_token, google_token_expiry')
    .eq('id', userId)
    .single()

  if (!profile) return null
  const p = profile as any

  if (p.google_access_token && p.google_token_expiry && Date.now() < p.google_token_expiry - 60000) {
    return p.google_access_token
  }

  if (!p.google_refresh_token) return null

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: p.google_refresh_token,
      grant_type: 'refresh_token',
    }),
  })

  const data = await res.json()
  if (!data.access_token) return null

  await supabase.from('profiles').update({
    google_access_token: data.access_token,
    google_token_expiry: Date.now() + data.expires_in * 1000,
  } as any).eq('id', userId)

  return data.access_token
}

function extractSheetId(url: string): string | null {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  return match ? match[1] : null
}

export async function POST(request: NextRequest) {
  const { dipId, userId } = await request.json()

  if (!dipId || !userId) {
    return NextResponse.json({ error: 'Missing dipId or userId' }, { status: 400 })
  }

  const accessToken = await getValidAccessToken(userId)
  if (!accessToken) {
    return NextResponse.json({ error: 'not_connected' }, { status: 401 })
  }

  const { data: dip } = await supabase.from('dips').select('*').eq('id', dipId).single()
  const { data: spotsRaw } = await supabase.from('spots').select('*').eq('dip_id', dipId).order('spot_number', { ascending: true })

  if (!dip) return NextResponse.json({ error: 'Dip not found' }, { status: 404 })

  const spots = (spotsRaw || []) as any[]
  const showPaymentCols = ['payments', 'closed', 'drawn'].includes(dip.stage)
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

  // Create or get sheet
  let sheetId = dip.google_sheet_link ? extractSheetId(dip.google_sheet_link) : null

  if (!sheetId) {
    const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        properties: { title: dip.title },
        sheets: [{ properties: { title: 'Unicorn' } }],
      }),
    })

    const created = await createRes.json()
    sheetId = created.spreadsheetId
    if (!sheetId) return NextResponse.json({ error: 'Could not create sheet' }, { status: 500 })

    const sheetUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/edit`
    await supabase.from('dips').update({ google_sheet_link: sheetUrl } as any).eq('id', dipId)

    await fetch(`https://www.googleapis.com/drive/v3/files/${sheetId}/permissions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'reader', type: 'anyone' }),
    })
  }

  // Get sheet tab ID
  const sheetMetaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  const sheetMeta = await sheetMetaRes.json()
  const sheetTabId = sheetMeta.sheets?.[0]?.properties?.sheetId ?? 0

  // Clear sheet
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Unicorn!A1:Z2000:clear`,
    { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` } }
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
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Unicorn!A1?valueInputOption=RAW`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values }),
    }
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

  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests: formatRequests }),
    }
  )

  return NextResponse.json({ success: true, sheetId })
}
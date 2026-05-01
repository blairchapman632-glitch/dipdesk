export default function CommunityPage() {
  return (
    <div className="min-h-screen bg-white px-6 py-12 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Community Guidelines</h1>
      <p className="text-sm text-gray-500 mb-8">Last updated: May 2026</p>

      <p className="text-sm text-gray-700 leading-relaxed mb-8">WrapApp is built for the wrap community — a passionate, generous, and supportive group of people. These guidelines exist to keep it that way.</p>

      <div className="space-y-6 text-sm text-gray-700 leading-relaxed">
        <section>
          <h2 className="text-base font-bold text-gray-900 mb-2">Be Kind and Respectful</h2>
          <p>Treat every member of the community with kindness and respect. Harassment, bullying, or targeted negativity of any kind will not be tolerated and may result in account suspension.</p>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-2">Be Honest</h2>
          <p>Represent your wraps accurately. Photos and descriptions should reflect the true condition of your wraps. Misrepresentation in sales is a serious breach of community trust.</p>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-2">No Spam</h2>
          <p>Do not post repetitive content, unsolicited promotions, or irrelevant messages. Keep posts and messages relevant to the wrap community.</p>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-2">Buying and Selling</h2>
          <p>Follow through on commitments. If you agree to buy or sell, honour that agreement. Ghosting sellers or buyers damages community trust. Disputes should be handled respectfully and directly between parties.</p>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-2">Appropriate Content Only</h2>
          <p>All content posted on WrapApp must be appropriate for a general audience. Do not post offensive, explicit, or harmful content of any kind.</p>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-2">Respect Privacy</h2>
          <p>Do not share personal information about other users without their consent. Be mindful of what appears in your photos — especially images of children.</p>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-2">Reporting Issues</h2>
          <p>If you encounter behaviour that violates these guidelines, please contact us at blairchapman632@gmail.com. We take all reports seriously.</p>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-2">Enforcement</h2>
          <p>Breaches of these guidelines may result in content removal, account suspension, or permanent banning from WrapApp depending on severity.</p>
        </section>
      </div>

      <div className="mt-12 pt-6 border-t">
        <a href="/tools" className="text-sm text-pink-500 font-semibold">← Back to WrapApp</a>
      </div>
    </div>
  )
}
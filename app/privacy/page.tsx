export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white px-6 py-12 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
      <p className="text-sm text-gray-500 mb-8">Last updated: May 2026</p>

      <div className="space-y-6 text-sm text-gray-700 leading-relaxed">
        <section>
          <h2 className="text-base font-bold text-gray-900 mb-2">1. Who We Are</h2>
          <p>WrapApp is operated by Paige Chapman, based in Perth, Western Australia. We are committed to protecting your personal information in accordance with the Australian Privacy Act 1988 and the Australian Privacy Principles.</p>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-2">2. Information We Collect</h2>
          <p>We collect information you provide when creating an account, including your name, email address, profile photo, and bio. We also collect information about the wraps you add to your collection, including photos, descriptions, and purchase details. We collect usage data to improve the platform.</p>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-2">3. How We Use Your Information</h2>
          <p>We use your information to operate and improve WrapApp, to display your profile and collection to other users, to facilitate messaging and transactions between users, and to send you notifications about activity on your account.</p>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-2">4. What We Share</h2>
          <p>Your profile, collection, and posts are visible to other WrapApp users. Your purchase prices are private and not visible to other users. We do not sell your personal information to third parties.</p>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-2">5. Data Storage</h2>
          <p>Your data is stored securely using Supabase infrastructure. Data may be stored on servers outside Australia, but we take reasonable steps to ensure it is protected.</p>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-2">6. Your Rights</h2>
          <p>You have the right to access, correct, or delete your personal information. You can update your profile at any time within the app. To request deletion of your account and data, contact us at blairchapman632@gmail.com.</p>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-2">7. Cookies and Local Storage</h2>
          <p>WrapApp uses browser local storage to cache your data for faster loading. This data is stored on your device and is not shared with third parties.</p>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-2">8. Changes to This Policy</h2>
          <p>We may update this policy from time to time. We will notify users of significant changes. Continued use of WrapApp constitutes acceptance of the updated policy.</p>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-2">9. Contact</h2>
          <p>For privacy related questions or requests, contact us at blairchapman632@gmail.com.</p>
        </section>
      </div>

      <div className="mt-12 pt-6 border-t">
        <a href="/tools" className="text-sm text-pink-500 font-semibold">← Back to WrapApp</a>
      </div>
    </div>
  )
}
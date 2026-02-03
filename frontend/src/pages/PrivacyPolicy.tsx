/**
 * Privacy Policy Page
 * Displays SkinAura PRO's privacy policy and data practices.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Shield } from 'lucide-react';

const CONTACT_EMAIL = 'skinauraai@gmail.com';

const PrivacyPolicy: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FDF8F6] via-white to-[#FDF8F6]">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <Link
              to="/"
              className="flex items-center gap-2 text-gray-600 hover:text-[#CFAFA3] transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Back</span>
            </Link>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#CFAFA3] to-[#E8D5D0] flex items-center justify-center">
                <img
                  src="https://emqiscdnvmjjrqapccib.supabase.co/storage/v1/object/public/progress-photos/logo.png"
                  alt="SkinAura PRO"
                  className="w-4 h-4"
                />
              </div>
              <span className="font-serif font-bold text-[#2D2A3E]">SkinAura PRO</span>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-12 h-12 rounded-xl bg-[#CFAFA3]/20 flex items-center justify-center">
            <Shield className="w-6 h-6 text-[#CFAFA3]" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[#2D2A3E]">
              Privacy Policy
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Last updated: February 2026
            </p>
          </div>
        </div>

        <div className="prose prose-gray max-w-none space-y-10">
          {/* Data */}
          <section>
            <h2 className="text-lg font-semibold text-[#2D2A3E] mb-4">Data</h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              We collect personal and activity data, which may be linked.
            </p>
            <p className="text-gray-600 leading-relaxed mb-4">
              We use technologies like cookies (small files stored on your browser), web beacons, or unique device identifiers to identify your computer or device so we can deliver a better experience. Our systems also log information like your browser, operating system and IP address.
            </p>
            <p className="text-gray-600 leading-relaxed mb-4">
              We also may collect personally identifiable information that you provide to us, such as your name, address, phone number or email address. With your permission, we may also access other personal information on your device, such as your phone book, calendar or messages, in order to provide services to you. If authorized by you, we may also access profile and other information from services like Facebook.
            </p>
            <p className="text-gray-600 leading-relaxed mb-4">
              Our systems may associate this personal information with your activities in the course of providing service to you (such as pages you view or things you click on or search for).
            </p>
            <p className="text-gray-600 leading-relaxed">
              We do not knowingly contact or collect personal information from children under 13. If you believe we have inadvertently collected such information, please contact us so we can promptly obtain parental consent or remove the information.
            </p>
          </section>

          {/* Location */}
          <section>
            <h2 className="text-lg font-semibold text-[#2D2A3E] mb-4">Location</h2>
            <p className="text-gray-600 leading-relaxed">
              We may collect and share anonymous location data. To customize our service for you, we and our partners may collect, use, and share precise location data, including the real-time geographic location of your computer or device. This location data is collected anonymously in a form that does not personally identify you and is used only to provide and improve our service. We may obtain your consent on your first use of the service.
            </p>
          </section>

          {/* Access */}
          <section>
            <h2 className="text-lg font-semibold text-[#2D2A3E] mb-4">Access</h2>
            <p className="text-gray-600 leading-relaxed">
              You can request to see or delete your personal data. You can sign in to your account to see or delete any personally identifiable information we have stored, such as your name, address, email, or phone number. You can also contact us by email to request to see or delete this information.
            </p>
          </section>

          {/* Deletion */}
          <section>
            <h2 className="text-lg font-semibold text-[#2D2A3E] mb-4">Deletion</h2>
            <p className="text-gray-600 leading-relaxed">
              We may keep data indefinitely.
            </p>
          </section>

          {/* Sharing */}
          <section>
            <h2 className="text-lg font-semibold text-[#2D2A3E] mb-4">Sharing</h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              We may share personal data with companies we trust.
            </p>
            <p className="text-gray-600 leading-relaxed mb-4">
              We may share personally identifiable information (such as name, address, email, or phone) with trusted partners in order to provide you with relevant advertising, offers or services.
            </p>
            <p className="text-gray-600 leading-relaxed mb-4">
              California residents are legally entitled (at no charge and no more than once annually) to request information about how we may have shared your information with others for direct marketing purposes. Contact us for this information:{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-[#CFAFA3] hover:underline font-medium">
                {CONTACT_EMAIL}
              </a>.
            </p>
            <p className="text-gray-600 leading-relaxed">
              No mobile information will be shared with third parties/affiliates for marketing and/or promotional purposes. All the above categories exclude text messaging originator opt-in data and consent; this information will not be shared with any third parties.
            </p>
          </section>

          {/* Ad Tracking */}
          <section>
            <h2 className="text-lg font-semibold text-[#2D2A3E] mb-4">Ad Tracking</h2>
            <p className="text-gray-600 leading-relaxed">
              Ad companies collect anonymous data. You can opt out.
            </p>
            <p className="text-gray-600 leading-relaxed mt-4">
              Ad companies may use and collect anonymous data about your interests to customize content and advertising here and in other sites and applications. Interest and location data may be linked to your device, but is not linked to your identity.
            </p>
          </section>

          {/* Contact */}
          <section>
            <h2 className="text-lg font-semibold text-[#2D2A3E] mb-4">Contact</h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              You can ask privacy questions.
            </p>
            <p className="text-gray-600 leading-relaxed">
              If you have any questions or concerns about our privacy policies, please contact us:{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-[#CFAFA3] hover:underline font-medium">
                {CONTACT_EMAIL}
              </a>.
            </p>
          </section>

          {/* Vendors */}
          <section>
            <h2 className="text-lg font-semibold text-[#2D2A3E] mb-4">Vendors</h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              Service providers access data on our behalf.
            </p>
            <p className="text-gray-600 leading-relaxed mb-4">
              In order to serve you, we may share your personal and anonymous information with other companies, including vendors and contractors. Their use of information is limited to these purposes, and subject to agreements that require them to keep the information confidential. Our vendors provide assurance that they take reasonable steps to safeguard the data they hold on our behalf, although data security cannot be guaranteed.
            </p>
            <p className="text-gray-600 leading-relaxed mb-4">
              Analytics companies may access anonymous data (such as your IP address or device ID) to help us understand how our services are used. They use this data solely on our behalf. They do not share it except in aggregate form; no data is shared as to any individual user. Click to see company privacy policies that govern their use of data.
            </p>
            <p className="text-gray-600 leading-relaxed mb-4">
              Vendors access data on our behalf.
            </p>
            <p className="text-gray-600 leading-relaxed mb-4">
              In order to serve you, we may share your personal and anonymous information with other companies, including vendors and contractors. Their use of information is limited to these purposes, and subject to agreements that require them to keep the information confidential. Our vendors provide assurance that they take reasonable steps to safeguard the data they hold on our behalf, although data security cannot be guaranteed.
            </p>
            <p className="text-gray-600 leading-relaxed">
              Analytics providers access data on our behalf. Analytics companies may access anonymous data (such as your IP address or device ID) to help us understand how our services are used. They use this data solely on our behalf. They do not share it except in aggregate form; no data is shared as to any individual user. Click to see company privacy policies that govern their use of data.
            </p>
          </section>

          {/* Special */}
          <section>
            <h2 className="text-lg font-semibold text-[#2D2A3E] mb-4">Special</h2>
            <p className="text-gray-600 leading-relaxed">
              Special situations may require disclosure of your data.
            </p>
            <p className="text-gray-600 leading-relaxed mt-4">
              To operate the service, we also may make identifiable and anonymous information available to third parties in these limited circumstances: (1) with your express consent, (2) when we have a good faith belief it is required by law, (3) when we have a good faith belief it is necessary to protect our rights or property, or (4) to any successor or purchaser in a merger, acquisition, liquidation, dissolution or sale of assets. Your consent will not be required for disclosure in these cases, but we will attempt to notify you, to the extent permitted by law, to do so.
            </p>
          </section>

          {/* More */}
          <section>
            <h2 className="text-lg font-semibold text-[#2D2A3E] mb-4">More</h2>
            <p className="text-gray-600 leading-relaxed">
              Our privacy policy may change from time to time.
            </p>
          </section>
        </div>

        {/* Footer CTA */}
        <div className="mt-16 pt-8 border-t border-gray-100">
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#2D2A3E] text-white rounded-xl font-medium hover:bg-[#3D3A4E] transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
        </div>
      </main>
    </div>
  );
};

export default PrivacyPolicy;

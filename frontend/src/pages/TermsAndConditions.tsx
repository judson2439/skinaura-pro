/**
 * Terms and Conditions Page
 * SMS/text messaging agreement and terms for SkinAura PRO.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, FileText } from 'lucide-react';

const COMPANY_NAME = 'SkinAura';
const SUPPORT_PHONE = '3014266442';
const PHONE_DISPLAY = '(301) 426-6442';

const TermsAndConditions: React.FC = () => {
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
            <FileText className="w-6 h-6 text-[#CFAFA3]" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[#2D2A3E]">
              Terms and Conditions
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Last updated: February 2026
            </p>
          </div>
        </div>

        <div className="prose prose-gray max-w-none space-y-10">
          {/* Agreement */}
          <section>
            <h2 className="text-lg font-semibold text-[#2D2A3E] mb-4">Agreement</h2>
            <h3 className="text-base font-semibold text-[#2D2A3E] mb-4">Agreement to Receive Text Messages</h3>
            <p className="text-gray-600 leading-relaxed mb-6">
              By providing your mobile number, you agree that {COMPANY_NAME} may send you periodic SMS or MMS messages containing but not limited to important information, updates, deals, and specials.
            </p>

            <ul className="space-y-3 text-gray-600 leading-relaxed list-none">
              <li className="flex gap-3">
                <span className="text-[#CFAFA3] mt-0.5">●</span>
                <span>You will receive up to 4 messages per month.</span>
              </li>
              <li className="flex gap-3">
                <span className="text-[#CFAFA3] mt-0.5">●</span>
                <span>You may unsubscribe at any time by texting the word STOP to <a href={`tel:+1${SUPPORT_PHONE}`} className="text-[#CFAFA3] hover:underline font-medium">{PHONE_DISPLAY}</a>. You may receive a subsequent message confirming your opt-out request.</span>
              </li>
              <li className="flex gap-3">
                <span className="text-[#CFAFA3] mt-0.5">●</span>
                <span>For help, send the word HELP to <a href={`tel:+1${SUPPORT_PHONE}`} className="text-[#CFAFA3] hover:underline font-medium">{PHONE_DISPLAY}</a>.</span>
              </li>
              <li className="flex gap-3">
                <span className="text-[#CFAFA3] mt-0.5">●</span>
                <span>Message and data rates may apply.</span>
              </li>
              <li className="flex gap-3">
                <span className="text-[#CFAFA3] mt-0.5">●</span>
                <span>United States Participating Carriers Include AT&T, T-Mobile®, Verizon Wireless, Sprint, Boost, U.S. Cellular®, MetroPCS®, InterOp, Cellcom, C Spire Wireless, Cricket, Virgin Mobile and others.</span>
              </li>
              <li className="flex gap-3">
                <span className="text-[#CFAFA3] mt-0.5">●</span>
                <span>T-Mobile is not liable for delayed or undelivered messages.</span>
              </li>
              <li className="flex gap-3">
                <span className="text-[#CFAFA3] mt-0.5">●</span>
                <span>You agree to notify us of any changes to your mobile number and update your account with us to reflect this change.</span>
              </li>
              <li className="flex gap-3">
                <span className="text-[#CFAFA3] mt-0.5">●</span>
                <span>Data obtained from you in connection with this SMS service may include your cell phone number, your carrier&apos;s name, and the date, time and content of your messages, as well as other information that you provide. We may use this information to contact you and to provide the services you request from us.</span>
              </li>
              <li className="flex gap-3">
                <span className="text-[#CFAFA3] mt-0.5">●</span>
                <span>By subscribing or otherwise using the service, you acknowledge and agree that we will have the right to change and/or terminate the service at any time, with or without cause and/or advance notice.</span>
              </li>
            </ul>

            <p className="text-gray-600 leading-relaxed mt-6">
              If you have any questions please contact {COMPANY_NAME} at{' '}
              <a href={`tel:+1${SUPPORT_PHONE}`} className="text-[#CFAFA3] hover:underline font-medium">
                {PHONE_DISPLAY}
              </a>.
            </p>
          </section>

          {/* Charges FAQ */}
          <section>
            <h2 className="text-lg font-semibold text-[#2D2A3E] mb-4">
              Will I be charged for the text messages I receive?
            </h2>
            <p className="text-gray-600 leading-relaxed">
              Though {COMPANY_NAME} will never charge you for the text messages you receive, depending on your phone plan, you may see some charges from your mobile provider. Please reach out to your wireless provider if you have questions about your text or data plan.
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

export default TermsAndConditions;

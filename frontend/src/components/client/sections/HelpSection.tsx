import React from 'react';

// ============================================================================
// TYPES
// ============================================================================

interface HelpSectionProps {
  userRole?: 'client' | 'professional';
}

// ============================================================================
// COMPONENT
// ============================================================================

const HelpSection: React.FC<HelpSectionProps> = ({ userRole = 'client' }) => {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
        <h2 className="text-2xl font-serif font-bold text-gray-900 mb-6">Help & FAQ</h2>
        
        <div className="space-y-4">
          <div className="p-4 bg-gray-50 rounded-xl">
            <h3 className="font-medium text-gray-900 mb-2">What is SkinAura PRO?</h3>
            <p className="text-gray-600 text-sm">
              SkinAura PRO is a professional skincare tracking platform designed for estheticians and their clients. 
              It helps track skincare routines, manage products, analyze progress photos, and monitor client compliance.
            </p>
          </div>
          
          <div className="p-4 bg-gray-50 rounded-xl">
            <h3 className="font-medium text-gray-900 mb-2">How do I track my routine?</h3>
            <p className="text-gray-600 text-sm">
              Simply mark your morning and evening routines as complete each day. 
              You'll earn points and build streaks for consistency!
            </p>
          </div>
          
          <div className="p-4 bg-gray-50 rounded-xl">
            <h3 className="font-medium text-gray-900 mb-2">How does the gamification work?</h3>
            <p className="text-gray-600 text-sm">
              Complete routines to earn 50 points each, with bonus points for maintaining streaks. 
              Progress through Bronze, Silver, Gold, Platinum, and Diamond levels.
            </p>
          </div>
          
          <div className="p-4 bg-gray-50 rounded-xl">
            <h3 className="font-medium text-gray-900 mb-2">Can I upload progress photos?</h3>
            <p className="text-gray-600 text-sm">
              Yes! Upload before, after, and progress photos to track your skincare journey. 
              Your professional can view and provide feedback on these photos.
            </p>
          </div>

          <div className="p-4 bg-gray-50 rounded-xl">
            <h3 className="font-medium text-gray-900 mb-2">How do streaks work?</h3>
            <p className="text-gray-600 text-sm">
              A streak represents consecutive days where you've completed at least one skincare routine. 
              Missing a day will reset your streak, so try to be consistent!
            </p>
          </div>

          <div className="p-4 bg-gray-50 rounded-xl">
            <h3 className="font-medium text-gray-900 mb-2">How do I earn badges?</h3>
            <p className="text-gray-600 text-sm">
              Badges are earned by completing various achievements like maintaining streaks, 
              uploading progress photos, adding products, and reaching certain milestones in your skincare journey.
            </p>
          </div>
          
          {userRole === 'professional' && (
            <>
              <div className="p-4 bg-gray-50 rounded-xl">
                <h3 className="font-medium text-gray-900 mb-2">How do I add clients?</h3>
                <p className="text-gray-600 text-sm">
                  Go to "My Clients" and click "Add Client". Enter your client's email address - 
                  they must have already signed up as a client on SkinAura PRO.
                </p>
              </div>
              
              <div className="p-4 bg-gray-50 rounded-xl">
                <h3 className="font-medium text-gray-900 mb-2">How do I create routines for clients?</h3>
                <p className="text-gray-600 text-sm">
                  Go to "Manage Routines" to create routine templates. Add steps with products and instructions, 
                  then assign the routine to specific clients.
                </p>
              </div>

              <div className="p-4 bg-gray-50 rounded-xl">
                <h3 className="font-medium text-gray-900 mb-2">How do I send reminders to clients?</h3>
                <p className="text-gray-600 text-sm">
                  From the client's profile or the compliance dashboard, click "Send Reminder" to send an SMS reminder. 
                  You'll need to have Twilio integration configured in your settings.
                </p>
              </div>

              <div className="p-4 bg-gray-50 rounded-xl">
                <h3 className="font-medium text-gray-900 mb-2">How do I annotate progress photos?</h3>
                <p className="text-gray-600 text-sm">
                  View a client's progress photo and click "Add Markup". Use the drawing tools to highlight areas 
                  of concern or improvement, then save your annotations for the client to see.
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Contact Support */}
      <div className="bg-gradient-to-r from-[#CFAFA3]/10 to-white rounded-2xl p-6 border border-[#CFAFA3]/20">
        <h3 className="font-serif font-bold text-lg text-gray-900 mb-2">Need More Help?</h3>
        <p className="text-gray-600 text-sm mb-4">
          Can't find what you're looking for? Our support team is here to help.
        </p>
        <div className="flex flex-wrap gap-3">
          <a
            href="mailto:support@skinaura.ai"
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:border-[#CFAFA3] hover:text-[#CFAFA3] transition-colors"
          >
            Email Support
          </a>
          <a
            href="https://skinaura.circle.so/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#CFAFA3] to-[#B89A8E] text-white rounded-xl text-sm font-medium hover:shadow-lg transition-all"
          >
            Join Community
          </a>
        </div>
      </div>
    </div>
  );
};

export default HelpSection;

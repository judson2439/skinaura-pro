import { Sparkles } from 'lucide-react';

const AppLayout = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F9F7F5] via-white to-[#F9F7F5]">
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#CFAFA3] to-[#E8D5D0] flex items-center justify-center mx-auto mb-6 shadow-lg">
            <img className="text-[#2D2A3E]" src={'https://emqiscdnvmjjrqapccib.supabase.co/storage/v1/object/public/progress-photos/logo.png'} width={40} height={40}/>
          </div>
          <h1 className="text-4xl font-bold text-[#2D2A3E] mb-3">
            Skincare Tracker
          </h1>
          <p className="text-gray-500 text-lg">
            Welcome to your skincare journey
          </p>
        </div>
      </div>
    </div>
  );
};

export default AppLayout;


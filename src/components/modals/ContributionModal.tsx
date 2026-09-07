import React, { useState, useEffect } from 'react';

interface ContributionModalProps {
  isOpen: boolean;
  onClose: () => void;
  cityName?: string;
}

const ContributionModal: React.FC<ContributionModalProps> = ({ isOpen, onClose, cityName }) => {
  const [step, setStep] = useState<'form' | 'success'>('form');
  const [formData, setFormData] = useState({
    email: '',
    isMinor: false,
    quirkyFact: '',
    report: '',
    agreedToTerms: false
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Automation: Save badge status to Local Storage
    const badges = JSON.parse(localStorage.getItem('userBadges') || '[]');
    if (!badges.includes('First Time Contributor')) {
      badges.push('First Time Contributor');
      localStorage.setItem('userBadges', JSON.stringify(badges));
    }
    setStep('success');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-blue-600 p-4 flex justify-between items-center text-white">
          <h2 className="text-xl font-bold">
            {step === 'form' ? `Contribute to ${cityName || 'City'}` : 'Contribution Received!'}
          </h2>
          <button onClick={onClose} className="hover:text-gray-200 text-2xl">&times;</button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[80vh]">
          {step === 'form' ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Quirky Questions */}
              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  What is the strangest or most unique thing about this city?
                </label>
                <textarea 
                  required
                  className="w-full border rounded-lg p-2 h-20 focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. They have a festival for squirrels..."
                  onChange={(e) => setFormData({...formData, quirkyFact: e.target.value})}
                />
              </div>

              {/* Long Form Report */}
              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  City Report / Personal Experience
                </label>
                <textarea 
                  className="w-full border rounded-lg p-2 h-32 focus:ring-2 focus:ring-blue-500"
                  placeholder="Tell us about the history, landmarks, or the vibe of the place..."
                  onChange={(e) => setFormData({...formData, report: e.target.value})}
                />
              </div>

              {/* Optional Email & Permission */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600">Email (Optional)</label>
                  <input 
                    type="email" 
                    className="w-full border rounded-lg p-2"
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                  />
                </div>
                <div className="flex items-center space-x-2 pt-6">
                  <input 
                    type="checkbox" 
                    id="minor"
                    onChange={(e) => setFormData({...formData, isMinor: e.target.checked})}
                  />
                  <label htmlFor="minor" className="text-sm text-gray-600">I am under 18 (Parental Consent)</label>
                </div>
              </div>

              {/* Legal Checkbox */}
              <div className="flex items-start space-x-2 py-2">
                <input 
                  type="checkbox" 
                  required
                  id="terms"
                  onChange={(e) => setFormData({...formData, agreedToTerms: e.target.checked})}
                />
                <label htmlFor="terms" className="text-xs text-gray-500 italic">
                  I agree to the terms of service and allow this data to be used publicly on LiveTimeData.com.
                </label>
              </div>

              <button 
                type="submit"
                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg transition"
              >
                Submit Report & Claim Badge
              </button>
            </form>
          ) : (
            /* Success Screen with Badge */
            <div className="text-center py-8">
              <div className="text-6xl mb-4">🏆</div>
              <h3 className="text-2xl font-bold text-gray-800 mb-2">You earned a badge!</h3>
              <div className="inline-block bg-yellow-100 border-2 border-yellow-400 text-yellow-800 px-4 py-2 rounded-full font-bold text-lg mb-6">
                🏅 First Time Contributor
              </div>
              <p className="text-gray-600 mb-6">
                Your report for <strong>{cityName}</strong> has been received. This helps other travelers and builds our community!
              </p>
              <button 
                onClick={onClose}
                className="bg-blue-600 text-white px-8 py-2 rounded-lg font-semibold hover:bg-blue-700"
              >
                Keep Exploring
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ContributionModal;
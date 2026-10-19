import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Send, Check } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export const Footer: React.FC = () => {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const handleNewsletterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    try {
      await supabase.from('newsletter_subscribers').insert({ email: email.trim() });
    } catch (err) {
      console.warn('Newsletter submission fallback:', err);
    }
    setSubscribed(true);
    setEmail('');
  };

  return (
    <footer className="bg-brand-black text-white pt-12 pb-8 px-4 border-t border-neutral-800" data-purpose="main-footer">
      <div className="max-w-7xl mx-auto space-y-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-12">
          {/* Brand & Mission */}
          <div className="lg:col-span-2 space-y-4">
            <Link to="/" className="inline-flex items-center space-x-2.5 group">
              <div className="w-10 h-10 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-center font-mono font-black text-xl text-white group-hover:border-red-600 transition-colors">
                T
              </div>
              <div className="flex flex-col text-left">
                <span className="text-2xl font-black tracking-tight uppercase font-mono leading-none group-hover:text-red-500 transition-colors">
                  Tryvoal
                </span>
                <span className="text-[10px] text-red-500 font-bold uppercase tracking-widest leading-none mt-1">
                  Anime store
                </span>
              </div>
            </Link>
            <p className="text-xs text-neutral-400 max-w-sm leading-relaxed">
              Tryvoal was created to serve and provide the coolest and most awesome looking anime street apparel and cursed collectibles for genuine otaku fans.
            </p>
            <div className="pt-2 text-xs text-neutral-500 space-y-1">
              <p>📍 Worldwide Express Shipping & Domestic Dispatch across India</p>
              <p>⚡ 450GSM Custom Cut Heavyweight Hoodies & Graphic Washed Tees</p>
            </div>
          </div>

          {/* Email Newsletter */}
          <div className="lg:col-span-1 bg-neutral-900/80 p-5 rounded-2xl border border-neutral-800 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white">Subscribe to Secret Drops</h3>
            <p className="text-xs text-neutral-400">Join our email list for exclusive drops, promo codes, and secret restocks.</p>
            {subscribed ? (
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold py-2">
                <Check className="w-4 h-4" />
                <span>You're in! Check your inbox soon.</span>
              </div>
            ) : (
              <form onSubmit={handleNewsletterSubmit} className="space-y-2">
                <input
                  type="email"
                  required
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-black border border-neutral-700 text-white text-xs px-3 py-2.5 rounded-lg focus:outline-none focus:border-red-500 placeholder-neutral-500"
                />
                <button
                  type="submit"
                  className="w-full bg-white hover:bg-neutral-200 text-black font-extrabold text-xs uppercase tracking-wider py-2.5 rounded-lg transition-colors active:scale-95 shadow"
                >
                  Subscribe
                </button>
              </form>
            )}
          </div>

          {/* Quick Links */}
          <div className="space-y-3 text-xs">
            <h4 className="font-bold text-white uppercase text-[11px] tracking-wider">Collections</h4>
            <ul className="space-y-2 text-neutral-400">
              <li><Link to="/shop" className="hover:text-white transition-colors">All Merch</Link></li>
              <li><Link to="/shop?category=Hoodies" className="hover:text-white transition-colors">Streetwear Hoodies</Link></li>
              <li><Link to="/shop?category=T-Shirts" className="hover:text-white transition-colors">Graphic T-Shirts</Link></li>
              <li><a href="/#shop-by-anime" className="hover:text-white transition-colors">Shop By Anime</a></li>
              <li><Link to="/shop?featured=true" className="hover:text-white transition-colors">Most Popular</Link></li>
            </ul>
          </div>

          {/* Support */}
          <div className="space-y-3 text-xs">
            <h4 className="font-bold text-white uppercase text-[11px] tracking-wider">Customer Support</h4>
            <ul className="space-y-2 text-neutral-400">
              <li><Link to="/track-order" className="hover:text-white transition-colors">Track Your Order</Link></li>
              <li><Link to="/contact" className="hover:text-white transition-colors">Contact Us</Link></li>
              <li><Link to="/faq" className="hover:text-white transition-colors">FAQ & Sizing</Link></li>
              <li><Link to="/shipping-policy" className="hover:text-white transition-colors">Shipping Policy</Link></li>
              <li><Link to="/refund-policy" className="hover:text-white transition-colors">Return & Refund</Link></li>
              <li><Link to="/privacy-policy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
              <li><Link to="/terms-conditions" className="hover:text-white transition-colors">Terms of Service</Link></li>
            </ul>
          </div>
        </div>

        {/* Developer Attribution Bar */}
        <div className="border-t border-neutral-800/80 pt-6 flex justify-center items-center">
          <a
            href="https://t.me/lennoxislive"
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-2.5 px-6 py-2.5 rounded-full bg-neutral-900 border border-neutral-700 hover:border-red-500 text-white shadow-md hover:shadow-lg transition-all duration-300 text-xs sm:text-sm font-semibold"
          >
            <span className="text-neutral-300">Made with</span>
            <span className="text-red-500 text-base" role="img" aria-label="love">❤️</span>
            <span className="text-neutral-300">by</span>
            <span className="text-white underline decoration-red-500 underline-offset-4 font-bold tracking-wide">
              lennoxislive
            </span>
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-600/20 text-red-400 group-hover:text-white transition-colors ml-0.5">
              <Send className="w-3 h-3 -rotate-45" />
            </span>
          </a>
        </div>

        {/* Payment Badges & Copyright */}
        <div className="border-t border-neutral-800 pt-6 text-center space-y-3">
          <div className="flex flex-wrap justify-center gap-2 text-[10px] text-neutral-400 uppercase font-mono">
            <span className="px-2.5 py-1 bg-neutral-900 rounded border border-neutral-800">Apple Pay</span>
            <span className="px-2.5 py-1 bg-neutral-900 rounded border border-neutral-800">Visa</span>
            <span className="px-2.5 py-1 bg-neutral-900 rounded border border-neutral-800">Mastercard</span>
            <span className="px-2.5 py-1 bg-neutral-900 rounded border border-neutral-800">PayPal</span>
            <span className="px-2.5 py-1 bg-neutral-900 rounded border border-neutral-800">UPI / QR</span>
          </div>
          <div className="flex flex-col sm:flex-row justify-center items-center gap-2 text-[11px] text-neutral-500">
            <p>© 2026, <span className="font-semibold text-neutral-300">Tryvoal : Anime store</span>. All rights reserved.</p>
            <span className="hidden sm:inline">•</span>
            <div className="flex items-center space-x-1.5 text-neutral-400">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              <span>100% Authentic Merchandise Guarantee</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

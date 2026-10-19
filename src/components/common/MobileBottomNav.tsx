import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ShoppingBag, Grid, Heart, ShoppingCart } from 'lucide-react';
import { useCartStore } from '../../store/useCartStore';
import { useWishlistStore } from '../../store/useWishlistStore';

export const MobileBottomNav: React.FC = () => {
  const location = useLocation();
  const cartCount = useCartStore((state) => state.getTotalItems());
  const wishlistCount = useWishlistStore((state) => state.items.length);

  // Hide on admin routes
  if (location.pathname.startsWith('/admin')) {
    return null;
  }

  const isShopActive = location.pathname === '/' || location.pathname === '/shop';
  const isWishlistActive = location.pathname.includes('wishlist');
  const isCartActive = location.pathname === '/cart';

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-gray-200 py-2 px-6 flex justify-around items-center z-40 text-[10px] font-bold text-gray-600"
      data-purpose="mobile-sticky-nav"
    >
      <Link
        to="/shop"
        className={`flex flex-col items-center transition-colors ${
          isShopActive ? 'text-red-600' : 'hover:text-gray-950'
        }`}
      >
        <ShoppingBag className="w-5 h-5 mb-0.5" />
        <span>Shop</span>
      </Link>

      <a
        href="/#shop-by-anime"
        className="flex flex-col items-center hover:text-gray-950 transition-colors"
      >
        <Grid className="w-5 h-5 mb-0.5" />
        <span>Anime</span>
      </a>

      <Link
        to="/dashboard?tab=wishlist"
        className={`flex flex-col items-center relative transition-colors ${
          isWishlistActive ? 'text-red-600' : 'hover:text-gray-950'
        }`}
      >
        {wishlistCount > 0 && (
          <span className="absolute -top-1 right-2 bg-red-600 text-white rounded-full text-[9px] w-3.5 h-3.5 flex items-center justify-center font-bold">
            {wishlistCount}
          </span>
        )}
        <Heart className="w-5 h-5 mb-0.5" />
        <span>Wishlist</span>
      </Link>

      <Link
        to="/cart"
        className={`flex flex-col items-center relative transition-colors ${
          isCartActive ? 'text-red-600' : 'hover:text-gray-950'
        }`}
      >
        {cartCount > 0 && (
          <span className="absolute -top-1 right-1.5 bg-brand-black text-white rounded-full text-[9px] w-3.5 h-3.5 flex items-center justify-center font-bold">
            {cartCount}
          </span>
        )}
        <ShoppingCart className="w-5 h-5 mb-0.5" />
        <span>Cart</span>
      </Link>
    </nav>
  );
};

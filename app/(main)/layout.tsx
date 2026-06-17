import Header from '@/components/Header/Header';
import BottomNav from '@/components/BottomNav/BottomNav';
import FloatingButtons from '@/components/FloatingButtons/FloatingButtons';
import CartToast from '@/components/CartToast/CartToast';
import OptionDrawer from '@/components/OptionDrawer/OptionDrawer';
import KakaoInit from '@/components/KakaoInit/KakaoInit';
import IdentityGate from '@/components/IdentityGate/IdentityGate';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <KakaoInit />
      <IdentityGate />
      <Header />
      {children}
      <BottomNav />
      <FloatingButtons />
      <CartToast />
      <OptionDrawer />
    </>
  );
}

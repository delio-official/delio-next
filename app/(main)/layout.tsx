import Header from '@/components/Header/Header';
import SiteFooter from '@/components/SiteFooter/SiteFooter';
import BottomNav from '@/components/BottomNav/BottomNav';
import FloatingButtons from '@/components/FloatingButtons/FloatingButtons';
import CartToast from '@/components/CartToast/CartToast';
import OptionDrawer from '@/components/OptionDrawer/OptionDrawer';
import KakaoInit from '@/components/KakaoInit/KakaoInit';
import IdentityGate from '@/components/IdentityGate/IdentityGate';
import ScrollReset from '@/components/ScrollReset/ScrollReset';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <KakaoInit />
      <ScrollReset />
      <IdentityGate />
      <Header />
      {children}
      <SiteFooter />
      <BottomNav />
      <FloatingButtons />
      <CartToast />
      <OptionDrawer />
    </>
  );
}

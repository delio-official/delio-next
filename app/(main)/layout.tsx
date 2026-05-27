import Header from '@/components/Header/Header';
import BottomNav from '@/components/BottomNav/BottomNav';
import FloatingButtons from '@/components/FloatingButtons/FloatingButtons';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      {children}
      <BottomNav />
      <FloatingButtons />
    </>
  );
}

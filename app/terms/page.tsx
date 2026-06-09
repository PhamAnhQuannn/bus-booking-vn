import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Điều khoản dịch vụ | BBVN',
  description: 'Điều khoản sử dụng dịch vụ đặt vé xe khách BBVN.',
};

export default function TermsPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-10">
      <h1 className="text-2xl font-bold">Điều khoản dịch vụ</h1>
      <p className="text-sm text-muted-foreground">
        Nội dung điều khoản dịch vụ đang được hoàn thiện. Khi sử dụng BBVN, bạn đồng ý đặt vé
        thông qua nền tảng và thanh toán theo phương thức đã chọn; nhà xe chịu trách nhiệm xác
        nhận chỗ và vận hành chuyến đi.
      </p>
      <p className="text-sm text-muted-foreground">
        Phiên bản đầy đủ sẽ được cập nhật trước khi ra mắt chính thức.
      </p>
    </main>
  );
}

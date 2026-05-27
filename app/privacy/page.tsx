import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Chính sách bảo mật | BBVN',
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-10">
      <h1 className="text-2xl font-bold">Chính sách bảo mật</h1>
      <p className="text-sm text-muted-foreground">
        BBVN thu thập số điện thoại và tên để xử lý đặt vé và gửi xác nhận qua SMS. Dữ liệu được
        xử lý theo Nghị định 13/2023/NĐ-CP (PDPD). Bạn có thể yêu cầu xoá tài khoản trong mục Cài
        đặt; lịch sử đặt vé được lưu theo quy định pháp luật ngay cả sau khi xoá tài khoản.
      </p>
      <p className="text-sm text-muted-foreground">
        Phiên bản đầy đủ sẽ được cập nhật trước khi ra mắt chính thức.
      </p>
    </main>
  );
}

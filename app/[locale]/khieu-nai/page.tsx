import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Giải quyết khiếu nại | BBVN',
  description: 'Quy trình tiếp nhận và giải quyết khiếu nại, tranh chấp khi sử dụng dịch vụ đặt vé xe khách BBVN.',
};

export default function ComplaintPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10">
      <h1 className="text-2xl font-bold">Chính sách giải quyết khiếu nại và tranh chấp</h1>
      <p className="text-sm text-muted-foreground">Cập nhật: Tháng 7, 2026</p>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">1. Giới thiệu</h2>
        <p className="text-sm leading-relaxed">
          BBVN là nền tảng trung gian kết nối khách hàng với nhà xe. Nhà xe chịu trách nhiệm về dịch vụ
          vận chuyển. Chính sách này mô tả quy trình tiếp nhận và giải quyết khiếu nại theo Luật Bảo vệ
          quyền lợi người tiêu dùng 2023 (Luật 19/2023/QH15, Điều 37-39).
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">2. Kênh tiếp nhận khiếu nại</h2>
        <ul className="list-disc pl-6 text-sm leading-relaxed">
          <li>
            <strong>Email (kênh chính thức):</strong>{' '}
            <a href="mailto:support@bbvn.vn" className="text-primary underline">
              support@bbvn.vn
            </a>
          </li>
          <li>
            <strong>Thông tin cần cung cấp:</strong> Mã đặt vé (nếu có), số điện thoại đặt vé, mô tả
            vấn đề, bằng chứng (nếu có).
          </li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">3. Quy trình xử lý và thời hạn</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="py-2 pr-4 font-semibold">Bước</th>
                <th className="py-2 pr-4 font-semibold">Nội dung</th>
                <th className="py-2 font-semibold">Thời hạn</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              <tr>
                <td className="py-2 pr-4">1</td>
                <td className="py-2 pr-4">Tiếp nhận và xác nhận</td>
                <td className="py-2">3 ngày làm việc</td>
              </tr>
              <tr>
                <td className="py-2 pr-4">2</td>
                <td className="py-2 pr-4">Xem xét và đề xuất giải pháp</td>
                <td className="py-2">7-30 ngày làm việc</td>
              </tr>
              <tr>
                <td className="py-2 pr-4">3</td>
                <td className="py-2 pr-4">Thông báo kết quả</td>
                <td className="py-2">Qua email</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-sm leading-relaxed">
          Khiếu nại đơn giản (lỗi hệ thống, thanh toán không ghi nhận) được xử lý trong 7 ngày làm
          việc. Khiếu nại phức tạp (tranh chấp với nhà xe, hoàn tiền đặc biệt) có thể mất đến 30 ngày
          làm việc.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">4. Phân loại khiếu nại</h2>
        <ul className="list-disc pl-6 text-sm leading-relaxed">
          <li>
            <strong>Vấn đề đặt vé / thanh toán:</strong> Thanh toán không ghi nhận, lỗi hệ thống,
            sai thông tin vé.
          </li>
          <li>
            <strong>Vấn đề hoàn tiền:</strong> Xem{' '}
            <Link href="/chinh-sach-huy-ve-hoan-tien" className="text-primary underline">
              Chính sách hủy vé và hoàn tiền
            </Link>
            .
          </li>
          <li>
            <strong>Chất lượng dịch vụ / thái độ nhà xe:</strong> BBVN chuyển khiếu nại đến nhà xe
            liên quan.
          </li>
          <li>
            <strong>Vấn đề an toàn:</strong> Xử lý khẩn cấp, không áp dụng thời hạn tiêu chuẩn.
          </li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">5. Vai trò của nhà xe trong giải quyết tranh chấp</h2>
        <p className="text-sm leading-relaxed">
          BBVN chuyển khiếu nại liên quan đến vận chuyển/dịch vụ tới nhà xe. Nhà xe có trách nhiệm phản
          hồi trong thời hạn do BBVN quy định.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">6. Quyền của khách hàng khi không được giải quyết thỏa đáng</h2>
        <p className="text-sm leading-relaxed">
          Nếu bạn không hài lòng với kết quả giải quyết, bạn có quyền:
        </p>
        <ul className="list-disc pl-6 text-sm leading-relaxed">
          <li>Liên hệ Cục Cạnh tranh và Bảo vệ người tiêu dùng (VCCA).</li>
          <li>Liên hệ Sở Công Thương địa phương.</li>
          <li>Khởi kiện tại tòa án có thẩm quyền tại Việt Nam.</li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">7. Bảo mật thông tin khiếu nại</h2>
        <p className="text-sm leading-relaxed">
          Thông tin khiếu nại chỉ được sử dụng cho mục đích giải quyết tranh chấp, theo{' '}
          <Link href="/privacy" className="text-primary underline">
            Chính sách bảo mật
          </Link>
          .
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">8. Liên hệ</h2>
        <p className="text-sm leading-relaxed">
          Email:{' '}
          <a href="mailto:support@bbvn.vn" className="text-primary underline">
            support@bbvn.vn
          </a>
        </p>
      </section>

      <p className="text-xs text-muted-foreground">Phiên bản: 2026-07</p>

      <nav className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-4 text-sm" aria-label="Chính sách liên quan">
        <span className="text-muted-foreground">Liên quan:</span>
        <Link href="/terms" className="text-primary underline">Điều khoản dịch vụ</Link>
        <Link href="/privacy" className="text-primary underline">Chính sách bảo mật</Link>
        <Link href="/chinh-sach-huy-ve-hoan-tien" className="text-primary underline">Chính sách hủy vé và hoàn tiền</Link>
      </nav>
    </main>
  );
}

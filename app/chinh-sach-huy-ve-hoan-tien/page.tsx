import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Chính sách hủy vé và hoàn tiền | BBVN',
  description: 'Chính sách hủy vé, hoàn tiền và các điều kiện áp dụng khi đặt vé xe khách qua BBVN.',
};

export default function CancellationRefundPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10">
      <h1 className="text-2xl font-bold">Chính sách hủy vé và hoàn tiền</h1>
      <p className="text-sm text-muted-foreground">Cập nhật: Tháng 8, 2026</p>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">1. Giới thiệu</h2>
        <p className="text-sm leading-relaxed">
          Chính sách này là một phần không thể tách rời của{' '}
          <Link href="/terms" className="text-primary underline">
            Điều khoản dịch vụ
          </Link>
          . Chính sách áp dụng cho tất cả vé xe khách đặt qua bbvn.vn.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">2. Phạm vi áp dụng</h2>
        <ul className="list-disc pl-6 text-sm leading-relaxed">
          <li>Áp dụng cho vé thanh toán qua chuyển khoản ngân hàng (VietQR) và tiền mặt.</li>
          <li>
            Không áp dụng cho đặt xe hợp đồng/thuê riêng — vui lòng liên hệ{' '}
            <Link href="/lien-he-dat-xe" className="text-primary underline">
              trang đặt xe riêng
            </Link>
            .
          </li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">3. Hủy vé theo yêu cầu khách hàng</h2>
        <p className="text-sm leading-relaxed">
          Vé đã thanh toán <strong>không thể hủy hoặc hoàn tiền theo yêu cầu của khách hàng</strong>.
          BBVN chỉ hoàn tiền trong trường hợp nhà xe hủy chuyến (xem Mục 5). Vui lòng kiểm tra kỹ
          thông tin chuyến đi và cân nhắc trước khi thanh toán.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">4. Không hoàn tiền trong các trường hợp</h2>
        <ul className="list-disc pl-6 text-sm leading-relaxed">
          <li>Khách hàng tự ý không đi, đổi lịch cá nhân hoặc yêu cầu hủy vé.</li>
          <li>Khách hàng không có mặt tại điểm đón đúng giờ (no-show).</li>
          <li>Vé đã sử dụng hoặc chuyến đi đã khởi hành.</li>
          <li>Phát hiện gian lận trong quá trình đặt vé hoặc thanh toán.</li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">5. Nhà xe hủy chuyến (xe không chạy)</h2>
        <p className="text-sm leading-relaxed">
          Đây là trường hợp duy nhất được hoàn tiền. Khi nhà xe hủy chuyến:
        </p>
        <ul className="list-disc pl-6 text-sm leading-relaxed">
          <li>Hoàn tiền 100% giá vé (không trừ phí) trong vòng 3-5 ngày làm việc.</li>
          <li>BBVN chủ động thông báo qua SMS/email ngay khi nhận thông tin từ nhà xe.</li>
          <li>Khách hàng không cần thao tác hủy — hệ thống tự động xử lý hoàn tiền.</li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">6. Quy trình nhận hoàn tiền khi nhà xe hủy chuyến</h2>
        <ul className="list-disc pl-6 text-sm leading-relaxed">
          <li>BBVN gửi thông báo hủy chuyến qua SMS/email tới số điện thoại/email đặt vé.</li>
          <li>Nếu cần, khách hàng cung cấp số tài khoản ngân hàng để nhận hoàn tiền.</li>
          <li>
            Mọi thắc mắc, liên hệ BBVN qua email{' '}
            <a href="mailto:support@bbvn.vn" className="text-primary underline">
              support@bbvn.vn
            </a>{' '}
            (kèm mã đặt vé và số điện thoại đặt vé).
          </li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">7. Thời gian và phương thức hoàn tiền</h2>
        <ul className="list-disc pl-6 text-sm leading-relaxed">
          <li>Hoàn tiền qua chuyển khoản ngân hàng: 3-5 ngày làm việc kể từ khi nhà xe xác nhận hủy chuyến.</li>
          <li>Vé thanh toán tiền mặt: trả trực tiếp cho nhà xe khi lên xe, nên chuyến không chạy sẽ không phát sinh khoản cần hoàn.</li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">8. Ghi chú về Luật Bảo vệ quyền lợi người tiêu dùng</h2>
        <p className="text-sm leading-relaxed">
          Theo Luật Bảo vệ quyền lợi người tiêu dùng 2023 (Luật 19/2023/QH15), quyền &quot;đổi trả
          hàng trong vòng X ngày&quot; (Điều 44) chỉ áp dụng cho bán hàng tận cửa (door-to-door),
          không áp dụng cho giao dịch đặt vé trực tuyến tự nguyện.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">9. Khiếu nại và liên hệ</h2>
        <p className="text-sm leading-relaxed">
          Nếu bạn không đồng ý với quyết định hoàn tiền, vui lòng xem{' '}
          <Link href="/khieu-nai" className="text-primary underline">
            Chính sách giải quyết khiếu nại
          </Link>
          . Email hỗ trợ:{' '}
          <a href="mailto:support@bbvn.vn" className="text-primary underline">
            support@bbvn.vn
          </a>
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">10. Thay đổi chính sách</h2>
        <p className="text-sm leading-relaxed">
          Thay đổi quan trọng sẽ được thông báo tối thiểu 30 ngày trước khi có hiệu lực, phù hợp với{' '}
          <Link href="/terms" className="text-primary underline">
            Điều khoản dịch vụ
          </Link>
          .
        </p>
      </section>

      <p className="text-xs text-muted-foreground">Phiên bản: 2026-08</p>

      <nav className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-4 text-sm" aria-label="Chính sách liên quan">
        <span className="text-muted-foreground">Liên quan:</span>
        <Link href="/terms" className="text-primary underline">Điều khoản dịch vụ</Link>
        <Link href="/privacy" className="text-primary underline">Chính sách bảo mật</Link>
        <Link href="/khieu-nai" className="text-primary underline">Giải quyết khiếu nại</Link>
      </nav>
    </main>
  );
}

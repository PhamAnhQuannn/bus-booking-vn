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
      <p className="text-sm text-muted-foreground">Cập nhật: Tháng 7, 2026</p>

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
        <h2 className="text-lg font-semibold">3. Chính sách hủy vé do khách hàng</h2>
        {/* TODO: Confirm refund percentages with business before launch */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="py-2 pr-4 font-semibold">Thời điểm hủy</th>
                <th className="py-2 font-semibold">Tỷ lệ hoàn tiền</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              <tr>
                <td className="py-2 pr-4">Trước giờ khởi hành &gt; 24 giờ</td>
                <td className="py-2">70% giá vé</td>
              </tr>
              <tr>
                <td className="py-2 pr-4">Từ 3 đến 24 giờ trước giờ khởi hành</td>
                <td className="py-2">30% giá vé</td>
              </tr>
              <tr>
                <td className="py-2 pr-4">Dưới 3 giờ trước giờ khởi hành</td>
                <td className="py-2">Không hoàn tiền</td>
              </tr>
              <tr>
                <td className="py-2 pr-4">Không lên xe (no-show)</td>
                <td className="py-2">Không hoàn tiền</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">4. Không hoàn tiền trong các trường hợp</h2>
        <ul className="list-disc pl-6 text-sm leading-relaxed">
          <li>Khách hàng không có mặt tại điểm đón đúng giờ (no-show).</li>
          <li>Vé đã sử dụng hoặc chuyến đi đã khởi hành.</li>
          <li>Phát hiện gian lận trong quá trình đặt vé hoặc thanh toán.</li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">5. Nhà xe hủy chuyến</h2>
        <ul className="list-disc pl-6 text-sm leading-relaxed">
          <li>Hoàn tiền 100% giá vé trong vòng 3-5 ngày làm việc.</li>
          <li>BBVN sẽ thông báo qua SMS/email ngay khi nhận thông tin từ nhà xe.</li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">6. Quy trình hủy vé</h2>
        <ul className="list-disc pl-6 text-sm leading-relaxed">
          <li>
            Liên hệ BBVN qua email{' '}
            <a href="mailto:support@bbvn.vn" className="text-primary underline">
              support@bbvn.vn
            </a>
            .
          </li>
          <li>Cung cấp: mã đặt vé, số điện thoại đặt vé, lý do hủy.</li>
          <li>Thời gian xử lý yêu cầu hủy: trong vòng 1 ngày làm việc.</li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">7. Thời gian và phương thức hoàn tiền</h2>
        <ul className="list-disc pl-6 text-sm leading-relaxed">
          <li>Chuyển khoản ngân hàng: 3-5 ngày làm việc kể từ ngày hủy được xác nhận.</li>
          {/* TODO: Confirm cash-refund mechanics with business */}
          <li>Tiền mặt: hoàn trả qua chuyển khoản ngân hàng (khách hàng cung cấp số tài khoản).</li>
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

      <p className="text-xs text-muted-foreground">Phiên bản: 2026-07</p>

      <nav className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-4 text-sm" aria-label="Chính sách liên quan">
        <span className="text-muted-foreground">Liên quan:</span>
        <Link href="/terms" className="text-primary underline">Điều khoản dịch vụ</Link>
        <Link href="/privacy" className="text-primary underline">Chính sách bảo mật</Link>
        <Link href="/khieu-nai" className="text-primary underline">Giải quyết khiếu nại</Link>
      </nav>
    </main>
  );
}

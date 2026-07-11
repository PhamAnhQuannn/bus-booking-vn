import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Điều khoản dịch vụ | BBVN',
  description: 'Điều khoản sử dụng dịch vụ đặt vé xe khách BBVN.',
};

export default function TermsPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10">
      <h1 className="text-2xl font-bold">Điều khoản dịch vụ</h1>
      <p className="text-sm text-muted-foreground">Cập nhật: Tháng 7, 2026</p>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">1. Giới thiệu</h2>
        <p className="text-sm leading-relaxed">
          Điều khoản dịch vụ này (&quot;Điều khoản&quot;) điều chỉnh việc sử dụng nền tảng đặt vé xe
          khách BBVN (&quot;Dịch vụ&quot;). Khi đặt vé qua BBVN, bạn đồng ý tuân
          thủ các Điều khoản này.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">2. Dịch vụ cung cấp</h2>
        <p className="text-sm leading-relaxed">
          BBVN là nền tảng trung gian kết nối khách hàng với nhà xe. Chúng tôi cung cấp:
        </p>
        <ul className="list-disc pl-6 text-sm leading-relaxed">
          <li>Tìm kiếm và so sánh chuyến xe khách liên tỉnh.</li>
          <li>Đặt chỗ và thanh toán trực tuyến qua chuyển khoản ngân hàng.</li>
          <li>Xác nhận vé và thông báo qua email.</li>
          <li>Thanh toán tiền mặt trực tiếp tại điểm đón khi lên xe.</li>
        </ul>
        <p className="text-sm leading-relaxed">
          BBVN không phải là nhà vận tải. Nhà xe chịu trách nhiệm về dịch vụ vận chuyển, an toàn và
          đúng giờ.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">3. Thông tin đặt vé</h2>
        <ul className="list-disc pl-6 text-sm leading-relaxed">
          <li>Khi đặt vé, bạn cung cấp thông tin liên hệ (tên, số điện thoại, email) cho mỗi lần đặt.</li>
          <li>BBVN không yêu cầu tạo tài khoản. Mỗi lần đặt vé là giao dịch độc lập.</li>
          <li>Bạn chịu trách nhiệm cung cấp thông tin chính xác để nhận xác nhận vé và liên hệ khi cần.</li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">4. Đặt vé và thanh toán</h2>
        <ul className="list-disc pl-6 text-sm leading-relaxed">
          <li>Ghế được giữ chỗ tạm thời (tối đa 12 phút) trong lúc thanh toán.</li>
          <li>
            Thanh toán qua chuyển khoản ngân hàng. Vé được xác nhận sau khi nhận được thanh toán
            thành công.
          </li>
          <li>Giá vé hiển thị đã bao gồm tất cả phí. Không có phí ẩn.</li>
          <li>
            Nếu thanh toán không hoàn tất trong thời gian giữ chỗ, ghế sẽ được trả lại để người
            khác đặt.
          </li>
          <li>Thanh toán tiền mặt: trả trực tiếp cho nhà xe tại điểm đón khi lên xe.</li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">5. Hủy vé và hoàn tiền</h2>
        <p className="text-sm leading-relaxed">
          Chính sách hủy vé và hoàn tiền được quy định chi tiết tại{' '}
          <Link href="/chinh-sach-huy-ve-hoan-tien" className="text-primary underline">
            Chính sách hủy vé và hoàn tiền
          </Link>
          . Chính sách này là một phần không thể tách rời của Điều khoản dịch vụ.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">6. Trách nhiệm của khách hàng</h2>
        <ul className="list-disc pl-6 text-sm leading-relaxed">
          <li>Cung cấp thông tin chính xác khi đặt vé (tên, số điện thoại).</li>
          <li>Có mặt tại điểm đón đúng giờ.</li>
          <li>Tuân thủ quy định của nhà xe trong suốt chuyến đi.</li>
          <li>Không sử dụng Dịch vụ cho mục đích gian lận hoặc bất hợp pháp.</li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">7. Giới hạn trách nhiệm</h2>
        <p className="text-sm leading-relaxed">
          BBVN không chịu trách nhiệm về: (a) chất lượng dịch vụ vận chuyển do nhà xe cung cấp; (b)
          thiệt hại do chậm trễ, hủy chuyến hoặc tai nạn trong quá trình vận chuyển; (c) mất mát
          hành lý hoặc tài sản cá nhân trên xe. Trách nhiệm bồi thường tối đa của BBVN không vượt
          quá giá trị vé đã thanh toán.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">8. Sở hữu trí tuệ</h2>
        <p className="text-sm leading-relaxed">
          Toàn bộ nội dung, thiết kế, logo và mã nguồn của BBVN thuộc quyền sở hữu của chúng tôi và
          được bảo hộ theo pháp luật Việt Nam về sở hữu trí tuệ.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">9. Thay đổi điều khoản</h2>
        <p className="text-sm leading-relaxed">
          Chúng tôi có thể cập nhật Điều khoản này. Thay đổi quan trọng sẽ được thông báo qua email
          tối thiểu 30 ngày trước khi có hiệu lực. Việc tiếp tục sử dụng Dịch vụ sau khi thay đổi
          đồng nghĩa với việc bạn chấp nhận Điều khoản mới.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">10. Luật áp dụng</h2>
        <p className="text-sm leading-relaxed">
          Điều khoản này được điều chỉnh bởi pháp luật Việt Nam. Mọi tranh chấp sẽ được giải quyết
          tại tòa án có thẩm quyền tại Việt Nam.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">11. Liên hệ</h2>
        <p className="text-sm leading-relaxed">
          Nếu có câu hỏi về Điều khoản dịch vụ, vui lòng liên hệ qua email:{' '}
          <a href="mailto:support@bbvn.vn" className="text-primary underline">
            support@bbvn.vn
          </a>
          . Để khiếu nại, vui lòng xem{' '}
          <Link href="/khieu-nai" className="text-primary underline">
            Chính sách giải quyết khiếu nại
          </Link>
          .
        </p>
      </section>

      <p className="text-xs text-muted-foreground">Phiên bản: 2026-07</p>

      <nav className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-4 text-sm" aria-label="Chính sách liên quan">
        <span className="text-muted-foreground">Liên quan:</span>
        <Link href="/privacy" className="text-primary underline">Chính sách bảo mật</Link>
        <Link href="/chinh-sach-huy-ve-hoan-tien" className="text-primary underline">Chính sách hủy vé và hoàn tiền</Link>
        <Link href="/khieu-nai" className="text-primary underline">Giải quyết khiếu nại</Link>
      </nav>
    </main>
  );
}

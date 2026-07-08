import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Điều khoản dịch vụ | BBVN',
  description: 'Điều khoản sử dụng dịch vụ đặt vé xe khách BBVN.',
};

export default function TermsPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10">
      <h1 className="text-2xl font-bold">Điều khoản dịch vụ</h1>
      <p className="text-sm text-muted-foreground">Cập nhật: Tháng 6, 2026</p>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">1. Giới thiệu</h2>
        <p className="text-sm leading-relaxed">
          Điều khoản dịch vụ này (&quot;Điều khoản&quot;) điều chỉnh việc sử dụng nền tảng đặt vé xe
          khách BBVN (&quot;Dịch vụ&quot;). Khi tạo tài khoản hoặc đặt vé qua BBVN, bạn đồng ý tuân
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
        </ul>
        <p className="text-sm leading-relaxed">
          BBVN không phải là nhà vận tải. Nhà xe chịu trách nhiệm về dịch vụ vận chuyển, an toàn và
          đúng giờ.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">3. Tài khoản</h2>
        <ul className="list-disc pl-6 text-sm leading-relaxed">
          <li>Bạn cần số điện thoại hợp lệ tại Việt Nam để đăng ký.</li>
          <li>Bạn chịu trách nhiệm bảo mật tài khoản và mã OTP của mình.</li>
          <li>Mỗi số điện thoại chỉ được liên kết với một tài khoản.</li>
          <li>Bạn có thể xóa tài khoản bất kỳ lúc nào qua mục Cài đặt.</li>
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
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">5. Hủy vé và hoàn tiền</h2>
        <ul className="list-disc pl-6 text-sm leading-relaxed">
          <li>Bạn có thể hủy vé trước giờ khởi hành qua ứng dụng.</li>
          <li>
            Chính sách hoàn tiền tùy thuộc vào quy định của từng nhà xe và thời điểm hủy so với
            giờ khởi hành.
          </li>
          <li>
            Hoàn tiền (nếu áp dụng) được xử lý qua chuyển khoản ngân hàng trong vòng 3-5 ngày làm
            việc.
          </li>
          <li>
            Trường hợp nhà xe hủy chuyến: bạn được hoàn tiền 100% giá vé.
          </li>
        </ul>
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
          hoặc thông báo trong ứng dụng. Việc tiếp tục sử dụng Dịch vụ sau khi thay đổi đồng nghĩa
          với việc bạn chấp nhận Điều khoản mới.
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
        </p>
      </section>
    </main>
  );
}

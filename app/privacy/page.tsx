import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Chính sách bảo mật | BBVN',
  description: 'Cách BBVN thu thập, sử dụng và bảo vệ thông tin cá nhân của khách hàng.',
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10">
      <h1 className="text-2xl font-bold">Chính sách bảo mật</h1>
      <p className="text-sm text-muted-foreground">Cập nhật: Tháng 6, 2026</p>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">1. Giới thiệu</h2>
        <p className="text-sm leading-relaxed">
          BBVN (&quot;chúng tôi&quot;) cam kết bảo vệ quyền riêng tư của bạn theo Nghị định
          13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân (PDPD). Chính sách này mô tả cách chúng tôi thu
          thập, sử dụng, lưu trữ và bảo vệ thông tin cá nhân khi bạn sử dụng nền tảng đặt vé xe
          khách BBVN.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">2. Thông tin chúng tôi thu thập</h2>
        <ul className="list-disc pl-6 text-sm leading-relaxed">
          <li>
            <strong>Thông tin tài khoản:</strong> Số điện thoại (bắt buộc để đăng ký và xác thực
            OTP), họ tên, địa chỉ email (tùy chọn).
          </li>
          <li>
            <strong>Thông tin đặt vé:</strong> Tên hành khách, số điện thoại liên hệ, email liên hệ,
            điểm đón, chi tiết chuyến đi.
          </li>
          <li>
            <strong>Thông tin thanh toán:</strong> Trạng thái thanh toán, mã giao dịch ngân hàng. Chúng
            tôi không lưu trữ số thẻ ngân hàng hay thông tin đăng nhập ngân hàng.
          </li>
          <li>
            <strong>Dữ liệu kỹ thuật:</strong> Địa chỉ IP (dùng cho giới hạn truy cập), user agent
            trình duyệt, nhật ký truy cập.
          </li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">3. Mục đích sử dụng</h2>
        <ul className="list-disc pl-6 text-sm leading-relaxed">
          <li>Xử lý và xác nhận đặt vé xe khách.</li>
          <li>Gửi thông báo qua SMS (xác thực OTP, xác nhận vé, nhắc nhở chuyến đi).</li>
          <li>Hỗ trợ khách hàng và giải quyết tranh chấp.</li>
          <li>Cải thiện chất lượng dịch vụ và phát hiện gian lận.</li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">4. Cơ sở pháp lý</h2>
        <p className="text-sm leading-relaxed">
          Chúng tôi xử lý dữ liệu dựa trên: (a) sự đồng ý của bạn khi đăng ký tài khoản; (b) thực
          hiện hợp đồng đặt vé; (c) nghĩa vụ pháp lý theo quy định kế toán và lưu trữ chứng từ.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">5. Chia sẻ dữ liệu</h2>
        <p className="text-sm leading-relaxed">
          Chúng tôi chỉ chia sẻ thông tin cá nhân với:
        </p>
        <ul className="list-disc pl-6 text-sm leading-relaxed">
          <li>
            <strong>Nhà xe:</strong> Tên hành khách, số điện thoại liên hệ và điểm đón — để phục vụ
            chuyến đi.
          </li>
          <li>
            <strong>Nhà cung cấp dịch vụ:</strong> Cổng thanh toán (SePay), nhà cung cấp SMS (eSMS)
            — chỉ trong phạm vi cần thiết để thực hiện dịch vụ.
          </li>
          <li>
            <strong>Cơ quan nhà nước:</strong> Khi có yêu cầu theo quy định pháp luật Việt Nam.
          </li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">6. Lưu trữ và bảo mật</h2>
        <p className="text-sm leading-relaxed">
          Dữ liệu được lưu trữ trên máy chủ tại Việt Nam. Chúng tôi áp dụng mã hóa AES-256 cho
          thông tin nhạy cảm, mã hóa kết nối SSL/TLS, và kiểm soát truy cập nghiêm ngặt. Mật khẩu
          được băm (hash) một chiều, không lưu dạng rõ.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">7. Thời gian lưu trữ</h2>
        <ul className="list-disc pl-6 text-sm leading-relaxed">
          <li>Thông tin tài khoản: cho đến khi bạn yêu cầu xóa.</li>
          <li>Lịch sử đặt vé và chứng từ thanh toán: tối thiểu 5 năm theo quy định kế toán.</li>
          <li>Nhật ký truy cập: 90 ngày.</li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">8. Quyền của bạn</h2>
        <p className="text-sm leading-relaxed">
          Theo Nghị định 13/2023/NĐ-CP, bạn có quyền:
        </p>
        <ul className="list-disc pl-6 text-sm leading-relaxed">
          <li>Truy cập và xem thông tin cá nhân của mình.</li>
          <li>Yêu cầu chỉnh sửa thông tin không chính xác.</li>
          <li>Yêu cầu xóa tài khoản (mục Cài đặt &gt; Xóa tài khoản).</li>
          <li>Rút lại sự đồng ý xử lý dữ liệu (bằng cách xóa tài khoản).</li>
        </ul>
        <p className="text-sm leading-relaxed">
          Lưu ý: lịch sử đặt vé và chứng từ thanh toán vẫn được lưu theo nghĩa vụ pháp lý ngay cả
          sau khi xóa tài khoản. Số điện thoại liên kết tài khoản đã xóa sẽ được vô hiệu hóa.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">9. Cookie và công nghệ theo dõi</h2>
        <p className="text-sm leading-relaxed">
          Chúng tôi sử dụng cookie kỹ thuật (phiên đăng nhập, xác thực CSRF, giữ chỗ) cần thiết để
          vận hành dịch vụ. Chúng tôi không sử dụng cookie theo dõi quảng cáo hay cookie bên thứ ba.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">10. Liên hệ</h2>
        <p className="text-sm leading-relaxed">
          Nếu có câu hỏi về chính sách bảo mật, vui lòng liên hệ qua email:{' '}
          <a href="mailto:privacy@bbvn.vn" className="text-primary underline">
            privacy@bbvn.vn
          </a>
        </p>
      </section>
    </main>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Chính sách bảo mật | BBVN',
  description: 'Cách BBVN thu thập, sử dụng và bảo vệ thông tin cá nhân của khách hàng.',
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10">
      <h1 className="text-2xl font-bold">Chính sách bảo mật</h1>
      <p className="text-sm text-muted-foreground">Cập nhật: Tháng 7, 2026</p>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">1. Giới thiệu</h2>
        <p className="text-sm leading-relaxed">
          BBVN (&quot;chúng tôi&quot;) cam kết bảo vệ quyền riêng tư của bạn theo Luật Bảo vệ dữ liệu
          cá nhân số 91/2025/QH15 (PDPL 2025) và Nghị định 356/2025/NĐ-CP. Chính sách này mô tả cách
          chúng tôi thu thập, sử dụng, lưu trữ và bảo vệ thông tin cá nhân khi bạn sử dụng nền tảng
          đặt vé xe khách BBVN.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">2. Thông tin chúng tôi thu thập</h2>
        <ul className="list-disc pl-6 text-sm leading-relaxed">
          <li>
            <strong>Thông tin liên hệ đặt vé:</strong> Số điện thoại liên hệ (bắt buộc để đặt vé và
            nhận thông báo), họ tên, địa chỉ email (tùy chọn).
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
          <li>Gửi thông báo qua email (xác nhận vé, nhắc nhở chuyến đi).</li>
          <li>Hỗ trợ khách hàng và giải quyết tranh chấp.</li>
          <li>Cải thiện chất lượng dịch vụ và phát hiện gian lận.</li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">4. Cơ sở pháp lý</h2>
        <p className="text-sm leading-relaxed">
          Chúng tôi xử lý dữ liệu dựa trên: (a) sự đồng ý của bạn khi đặt vé; (b) thực hiện hợp đồng
          đặt vé; (c) nghĩa vụ pháp lý theo quy định kế toán và lưu trữ chứng từ.
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
            <strong>Đối tác thanh toán:</strong> Xử lý giao dịch chuyển khoản ngân hàng (VietQR). Chúng
            tôi không lưu trữ số thẻ ngân hàng hay thông tin đăng nhập ngân hàng.
          </li>
          <li>
            <strong>Cơ quan nhà nước:</strong> Khi có yêu cầu theo quy định pháp luật Việt Nam.
          </li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">6. Lưu trữ và bảo mật</h2>
        <p className="text-sm leading-relaxed">
          Dữ liệu được lưu trữ trên máy chủ tại Singapore (Vercel, Neon, Upstash). Chúng tôi áp dụng
          mã hóa AES-256 cho thông tin nhạy cảm, mã hóa kết nối SSL/TLS, và kiểm soát truy cập nghiêm
          ngặt. Mật khẩu được băm (hash) một chiều, không lưu dạng rõ.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">6a. Chuyển dữ liệu ra nước ngoài</h2>
        <p className="text-sm leading-relaxed">
          Theo Điều 25 Luật PDPL 2025 và Nghị định 356/2025/NĐ-CP, chúng tôi thông báo rằng dữ liệu cá
          nhân của bạn được xử lý bởi các nhà cung cấp dịch vụ đám mây tại Singapore:
        </p>
        <ul className="list-disc pl-6 text-sm leading-relaxed">
          <li><strong>Vercel:</strong> Máy chủ ứng dụng (compute) — khu vực Singapore (sin1).</li>
          <li><strong>Neon:</strong> Cơ sở dữ liệu PostgreSQL — khu vực Singapore.</li>
          <li><strong>Upstash:</strong> Bộ nhớ đệm Redis — khu vực Singapore.</li>
        </ul>
        <p className="text-sm leading-relaxed">
          Việc chuyển dữ liệu ra nước ngoài tuân thủ các yêu cầu về đánh giá tác động chuyển dữ liệu
          xuyên biên giới (CDTIA) theo quy định PDPL 2025.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">7. Thời gian lưu trữ</h2>
        <ul className="list-disc pl-6 text-sm leading-relaxed">
          <li>Thông tin liên hệ đặt vé: cho đến khi bạn yêu cầu xóa hoặc hết nghĩa vụ lưu trữ pháp lý.</li>
          <li>Lịch sử đặt vé và chứng từ thanh toán: tối thiểu 5 năm theo quy định kế toán.</li>
          <li>Nhật ký truy cập: 90 ngày.</li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">8. Quyền của bạn</h2>
        <p className="text-sm leading-relaxed">
          Theo Luật PDPL 2025, bạn có các quyền sau:
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="py-2 pr-4 font-semibold">Quyền</th>
                <th className="py-2 font-semibold">Thời hạn xử lý</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              <tr>
                <td className="py-2 pr-4">Truy cập và xem thông tin cá nhân</td>
                <td className="py-2">10 ngày làm việc</td>
              </tr>
              <tr>
                <td className="py-2 pr-4">Yêu cầu chỉnh sửa thông tin không chính xác</td>
                <td className="py-2">10 ngày làm việc</td>
              </tr>
              <tr>
                <td className="py-2 pr-4">Yêu cầu xóa dữ liệu cá nhân</td>
                <td className="py-2">20 ngày làm việc</td>
              </tr>
              <tr>
                <td className="py-2 pr-4">Rút lại sự đồng ý xử lý dữ liệu</td>
                <td className="py-2">15 ngày làm việc</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-sm leading-relaxed">
          Để thực hiện các quyền này, vui lòng gửi email đến{' '}
          <a href="mailto:privacy@bbvn.vn" className="text-primary underline">
            privacy@bbvn.vn
          </a>
          .
        </p>
        <p className="text-sm leading-relaxed">
          Lưu ý: lịch sử đặt vé và chứng từ thanh toán vẫn được lưu theo nghĩa vụ pháp lý ngay cả
          sau khi xóa dữ liệu cá nhân.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">8a. Thông báo vi phạm dữ liệu</h2>
        <p className="text-sm leading-relaxed">
          Trong trường hợp vi phạm dữ liệu cá nhân, chúng tôi sẽ thông báo cho cơ quan chức năng trong
          vòng 72 giờ và trong vòng 24 giờ nếu liên quan đến tấn công mạng, theo quy định PDPL 2025.
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
          Phụ trách bảo vệ dữ liệu cá nhân — Email:{' '}
          <a href="mailto:privacy@bbvn.vn" className="text-primary underline">
            privacy@bbvn.vn
          </a>
        </p>
        <p className="text-sm leading-relaxed">
          Nếu bạn không hài lòng với cách xử lý khiếu nại, bạn có quyền liên hệ Cục Cạnh tranh và Bảo
          vệ người tiêu dùng (VCCA) hoặc cơ quan chức năng có thẩm quyền theo{' '}
          <Link href="/khieu-nai" className="text-primary underline">
            Chính sách giải quyết khiếu nại
          </Link>
          .
        </p>
      </section>

      <p className="text-xs text-muted-foreground">Phiên bản: 2026-07</p>

      <nav className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-4 text-sm" aria-label="Chính sách liên quan">
        <span className="text-muted-foreground">Liên quan:</span>
        <Link href="/terms" className="text-primary underline">Điều khoản dịch vụ</Link>
        <Link href="/chinh-sach-huy-ve-hoan-tien" className="text-primary underline">Chính sách hủy vé và hoàn tiền</Link>
        <Link href="/khieu-nai" className="text-primary underline">Giải quyết khiếu nại</Link>
      </nav>
    </main>
  );
}

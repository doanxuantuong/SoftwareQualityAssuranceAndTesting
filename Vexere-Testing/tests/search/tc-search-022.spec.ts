import { test, expect } from '@playwright/test';
import path from 'path';

const THU = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

// Ngày = hôm nay + soNgay. thangLech: 0 = tháng hiện tại, 1 = tháng kế tiếp (lịch hiển thị 2 tháng)
function ngayTu(soNgay: number) {
  const homNay = new Date();
  const d = new Date();
  d.setDate(d.getDate() + soNgay);
  const ngay = d.getDate();
  const thangLech = (d.getFullYear() - homNay.getFullYear()) * 12 + d.getMonth() - homNay.getMonth();
  const hienThi = `${THU[d.getDay()]}, ${String(ngay).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  return { ngay, thangLech, hienThi };
}

test('TC-SEARCH-022 - Ngày đi được website điền sẵn là ngày hôm nay khi không chọn ngày', async ({ page }) => {
  const homNay = ngayTu(0);
  const ddmm = homNay.hienThi.split(', ')[1].slice(0, 5);   // dd/mm, không phụ thuộc định dạng thứ

  // 1. Truy cập website Vexere
  await page.goto('https://vexere.com/');

  // 2. Đóng popup nếu xuất hiện
  const closeButton = page.getByRole('button', { name: 'close' });
  if (await closeButton.isVisible().catch(() => false)) {
    await closeButton.click();
  }

  // 3. Chọn Hà Nội → Hải Phòng
  await page.getByText('Nơi xuất phát').click();
  await page.getByTestId('SearchWidget.from').fill('Hà Nội');
  await page.getByRole('paragraph').filter({ hasText: /^Hà Nội(, [^,]+)?$/ }).filter({ visible: true }).first().click();
  await page.getByText('Nơi đến').click();
  await page.getByTestId('SearchWidget.to').fill('Hải Phòng');
  await page.getByRole('paragraph').filter({ hasText: /^Hải Phòng(, [^,]+)?$/ }).filter({ visible: true }).first().click();

  // 4. Quan sát ô Ngày đi (không nhấn vào ô này): đã có sẵn ngày hôm nay
  // Trên trang chủ ô Ngày đi hiện chữ "Ngày đi" nếu chưa có ngày; soft để test chạy tiếp và ghi nhận sai lệch với kết quả mong đợi
  const oNgayDi = page.getByText(ddmm).first();
  expect.soft(await oNgayDi.isVisible().catch(() => false), `Ô Ngày đi chưa điền sẵn ngày hôm nay (${homNay.hienThi})`).toBe(true);

  // 5. Nhấn nút tìm kiếm (không chọn ngày)
  await page.getByTestId('SearchWidget.search').click();
  await page.waitForTimeout(3000);
  const daChuyenTrang = new URL(page.url()).pathname !== '/';
  expect.soft(daChuyenTrang, 'Bấm Tìm kiếm khi chưa chọn ngày: trang không chuyển sang kết quả (ngày đi không được tự điền)').toBe(true);
  if (!daChuyenTrang) {
    await page.screenshot({ path: path.join(__dirname, '../search/screenshots/TC-SEARCH-022-FAIL.png'), fullPage: true });
    return;   // không còn gì để kiểm tra ở trang kết quả
  }

  // 6. Ngày hôm nay ở trang kết quả; có danh sách chuyến hoặc thông báo không có chuyến
  await expect(page.getByText(ddmm).first()).toBeVisible({ timeout: 20000 });
  await expect(
    page.getByText(/Kết quả[^:\n]*:\s*\d+\s*chuyến/).or(page.getByText(/Xin lỗi bạn vì sự bất tiện này/)).first()
  ).toBeVisible({ timeout: 20000 });

  // 7. Chụp ảnh minh chứng
  await page.screenshot({
    path: path.join(__dirname, '../search/screenshots/TC-SEARCH-022-PASS.png'),
    fullPage: true
  });

});
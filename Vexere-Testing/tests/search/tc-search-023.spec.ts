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

test('TC-SEARCH-023 - Tìm kiếm khi thiếu Nơi xuất phát (đủ Nơi đến và Ngày đi)', async ({ page }) => {
  const ngay = ngayTu(1);

  // 1. Truy cập website Vexere
  await page.goto('https://vexere.com/');

  // 2. Đóng popup nếu xuất hiện
  const closeButton = page.getByRole('button', { name: 'close' });
  if (await closeButton.isVisible().catch(() => false)) {
    await closeButton.click();
  }

  // 3. Chọn Nơi đến là Hà Nội và Ngày đi là hôm nay + 1 (website không tự điền ngày)
  await page.getByText('Nơi đến').click();
  await page.getByTestId('SearchWidget.to').fill('Hà Nội');
  await page.getByRole('paragraph').filter({ hasText: /^Hà Nội(, [^,]+)?$/ }).filter({ visible: true }).first().click();
  if (!(await page.getByText(/^Tháng \d{1,2}, \d{4}$/).first().isVisible().catch(() => false))) {
    await page.getByRole('paragraph').filter({ hasText: 'Ngày đi' }).first().click();
  }
  await page
    .locator('li > div > p:first-child', { hasText: new RegExp(`^${ngay.ngay}$`) })
    .nth(ngay.thangLech)
    .click();

  // 4. Nhấn nút tìm kiếm
  const urlTruoc = page.url();
  await page.getByTestId('SearchWidget.search').click();
  await page.waitForTimeout(2000);

  // 5. Không chuyển trang; Nơi đến vẫn được giữ
  expect(page.url()).toBe(urlTruoc);
  await expect(page.getByRole('textbox', { name: 'Nơi đến' })).toHaveValue(/Hà Nội/);
  // (Ghi lại phản hồi thực tế: thông báo, ô được làm nổi bật, nút nhạt màu - chờ xác nhận cách báo thiếu)

  // 6. Chụp ảnh minh chứng
  await page.screenshot({
    path: path.join(__dirname, '../search/screenshots/TC-SEARCH-023-PASS.png'),
    fullPage: true
  });

});
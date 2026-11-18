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

test('TC-SEARCH-004 - Tìm kiếm với ngày đi là ngày hôm nay', async ({ page }) => {
  const homNay = ngayTu(0);

  // 1. Truy cập website Vexere
  await page.goto('https://vexere.com/');

  // 2. Đóng popup nếu xuất hiện
  const closeButton = page.getByRole('button', { name: 'close' });
  if (await closeButton.isVisible().catch(() => false)) {
    await closeButton.click();
  }

  // 3. Chọn điểm đi: Hải Phòng
  await page.getByText('Nơi xuất phát').click();
  await page.getByTestId('SearchWidget.from').fill('Hải Phòng');
  await page.getByRole('paragraph').filter({ hasText: /^Hải Phòng$/ }).filter({ visible: true }).first().click();

  // 4. Chọn điểm đến: Sa Pa - Lào Cai
  await page.getByText('Nơi đến').click();
  await page.getByTestId('SearchWidget.to').fill('Sa Pa');
  await page.getByRole('paragraph').filter({ hasText: /^Sa Pa - Lào Cai$/ }).filter({ visible: true }).first().click();

  // 5. Ngày đi: website điền sẵn hôm nay; nếu chưa có thì mở lịch và chọn
  if (!(await page.getByText(homNay.hienThi).first().isVisible().catch(() => false))) {
    if (!(await page.getByText(/^Tháng \d{1,2}, \d{4}$/).first().isVisible().catch(() => false))) {
      await page.getByRole('paragraph').filter({ hasText: 'Ngày đi' }).first().click();
    }
    await page
      .locator('li > div > p:first-child', { hasText: new RegExp(`^${homNay.ngay}$`) })
      .nth(homNay.thangLech)
      .click();
  }
  await expect(page.getByText(homNay.hienThi).first()).toBeVisible();

  // 6. Nhấn nút tìm kiếm
  await Promise.all([
    page.waitForURL(url => url.pathname !== '/', { timeout: 20000 }),
    page.getByTestId('SearchWidget.search').click(),
  ]);

  // 7. Ngày hôm nay ở trang kết quả; có danh sách chuyến hoặc thông báo không có chuyến
  await expect(page.getByText(homNay.hienThi).first()).toBeVisible();
  await expect(
    page.getByText(/Kết quả[^:\n]*:\s*\d+\s*chuyến/).or(page.getByText(/Xin lỗi bạn vì sự bất tiện này/)).first()
  ).toBeVisible({ timeout: 20000 });

  // 8. Chụp ảnh minh chứng
  await page.screenshot({
    path: path.join(__dirname, '../search/screenshots/TC-SEARCH-004-PASS.png'),
    fullPage: true
  });

});
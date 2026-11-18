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

test('TC-SEARCH-019 - Tuyến không có chuyến', async ({ page }) => {
  const ngay = ngayTu(5);

  // 1. Truy cập website Vexere
  await page.goto('https://vexere.com/');

  // 2. Đóng popup nếu xuất hiện
  const closeButton = page.getByRole('button', { name: 'close' });
  if (await closeButton.isVisible().catch(() => false)) {
    await closeButton.click();
  }

  // 3. Chọn Hồ Chí Minh → Ban Dan - Buriram, hôm nay + 5
  await page.getByText('Nơi xuất phát').click();
  await page.getByTestId('SearchWidget.from').click();
  await page.getByRole('paragraph').filter({ hasText: /^Hồ Chí Minh$/ }).click();
  await page.getByText('Nơi đến').click();
  await page.getByTestId('SearchWidget.to').fill('Ban Dan');
  await page.getByRole('paragraph').filter({ hasText: /^Ban Dan - Buriram(, [^,]+)?$/ }).filter({ visible: true }).first().click();
  await page
    .locator('li > div > p:first-child', { hasText: new RegExp(`^${ngay.ngay}$`) })
    .nth(ngay.thangLech)
    .click();

  // 4. Nhấn nút tìm kiếm
  await Promise.all([
    page.waitForURL(url => url.pathname !== '/', { timeout: 20000 }),
    page.getByTestId('SearchWidget.search').click(),
  ]);

  // 5. Không có danh sách chuyến; có thông báo nêu ngày và hướng dẫn đổi tuyến
  await expect(page.getByText(/Xin lỗi bạn vì sự bất tiện này/)).toBeVisible({ timeout: 20000 });
  await expect(page.getByText(/Xin bạn vui lòng thay đổi tuyến đường tìm kiếm/)).toBeVisible();
  await expect(page.getByText(ngay.hienThi.split(', ')[1]).first()).toBeVisible();
  await expect(page.getByText(/Kết quả[^:\n]*:\s*\d+\s*chuyến/)).toHaveCount(0);

  // 6. Thanh tìm kiếm vẫn hiển thị để tìm lại
  await expect(page.getByTestId('SearchWidget.search')).toBeVisible();

  // 7. Chụp ảnh minh chứng
  await page.screenshot({
    path: path.join(__dirname, '../search/screenshots/TC-SEARCH-019-PASS.png'),
    fullPage: true
  });

});
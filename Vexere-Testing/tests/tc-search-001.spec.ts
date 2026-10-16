
import { test, expect } from '@playwright/test';

test('TC-SEARCH-001 - Tìm kiếm chuyến xe', async ({ page }) => {
  // 1. Mở website
  await page.goto('https://vexere.com/');

  // 2. Đóng hộp thoại nếu xuất hiện
  const closeButton = page.getByRole('button', { name: 'close' });

  if (await closeButton.isVisible().catch(() => false)) {
    await closeButton.click();
  }

  // 3. Chọn điểm đi
  await page.getByText('Nơi xuất phát').click();
  await page.getByTestId('SearchWidget.from').click();
  await page.getByRole('paragraph')
    .filter({ hasText: /^Hồ Chí Minh$/ })
    .click();

  // 4. Chọn điểm đến
  await page.getByText('Nơi đến').click();
  await page.getByTestId('SearchWidget.to').click();
  await page.locator('div')
    .filter({ hasText: /^Bà Rịa-Vũng TàuCŨ$/ })
    .first()
    .click();

  // 5. Chọn ngày đi
  await page.locator('div')
    .filter({ hasText: /^Ngày đi$/ })
    .nth(2)
    .click();

  await page.getByText('25').nth(1).click();

  // 6. Tìm kiếm
  await page.getByTestId('SearchWidget.search').click();

  // 7. Đợi điều hướng và ghi nhận URL
  await page.waitForURL(
    /ve-xe-khach-tu-ho-chi-minh-di-ba-ria-vung-tau-viet-nam/,
    { timeout: 30000 }
  );

  console.log('URL sau tìm kiếm:', page.url());

  // 8. ASSERTION: kiểm tra tuyến xe
  await expect(page).toHaveURL(
    /ve-xe-khach-tu-ho-chi-minh-di-ba-ria-vung-tau-viet-nam/
  );

  // 9. ASSERTION: kiểm tra ngày đi
  await expect(page).toHaveURL(/date=25-10-2026/);

  // 10. ASSERTION: trang kết quả có nội dung
  await expect(page.locator('body')).not.toBeEmpty();

  // 11. Lưu ảnh bằng chứng
  await page.screenshot({
  path: 'test-results/TC-SEARCH-001.png',
  fullPage: false,
  animations: 'disabled',
  timeout: 60000,
});
});

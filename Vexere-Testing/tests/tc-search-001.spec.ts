import { test, expect } from '@playwright/test';

test('TC-SEARCH-001 - Tìm kiếm chuyến xe', async ({ page }) => {
  // Bước 1: Mở website
  await page.goto('https://vexere.com/');

  // Bước 2: Đóng hộp thoại nếu nút đóng thực sự xuất hiện
  const closeButton = page.getByRole('button', { name: 'close' });

  if (await closeButton.isVisible().catch(() => false)) {
    await closeButton.click();
  }

  // Bước 3: Chọn điểm đi
  await page.getByText('Nơi xuất phát').click();
  await page.getByTestId('SearchWidget.from').click();
  await page.getByRole('paragraph')
    .filter({ hasText: /^Hồ Chí Minh$/ })
    .click();

  // Bước 4: Chọn điểm đến
  await page.getByText('Nơi đến').click();
  await page.getByTestId('SearchWidget.to').click();
  await page.locator('div')
    .filter({ hasText: /^Bà Rịa-Vũng TàuCŨ$/ })
    .first()
    .click();

  // Bước 5: Chọn ngày đi
  await page.locator('div')
    .filter({ hasText: /^Ngày đi$/ })
    .nth(2)
    .click();

  await page.getByText('25').nth(1).click();

  // Bước 6: Nhấn tìm kiếm
  await page.getByTestId('SearchWidget.search').click();

  // Bước 7: Ghi nhận kết quả để kiểm tra
  await page.waitForLoadState('domcontentloaded').catch(() => {});

  console.log('URL sau tìm kiếm:', page.url());

  await page.screenshot({
    path: 'test-results/TC-SEARCH-001.png',
    fullPage: true,
  });
});
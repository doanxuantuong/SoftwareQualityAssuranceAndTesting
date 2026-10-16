
import { test, expect } from '@playwright/test';

test('TC-SEARCH-002 - Hiển thị chức năng tìm kiếm', async ({ page }) => {
  // Mở website
 await page.goto('https://vexere.com/', {
  waitUntil: 'domcontentloaded',
  timeout: 60000,
});

  // Kiểm tra website đã tải
  await expect(page).toHaveURL(/vexere\.com/);

  // Kiểm tra chức năng chọn điểm đi
  await expect(page.getByText('Nơi xuất phát')).toBeVisible();

  // Kiểm tra chức năng chọn điểm đến
  await expect(page.getByText('Nơi đến')).toBeVisible();

  // Kiểm tra nút tìm kiếm
  await expect(page.getByTestId('SearchWidget.search')).toBeVisible();

  // Lưu ảnh bằng chứng
  await page.screenshot({
    path: 'test-results/TC-SEARCH-002.png',
    fullPage: true,
  });
});

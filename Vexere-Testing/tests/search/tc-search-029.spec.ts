import { test, expect, Page } from '@playwright/test';
import path from 'path';

const tieuDeThang = (page: Page) => page.getByText(/^Tháng \d{1,2}, \d{4}$/);
const cacONgay = (page: Page) => page.locator('li > div > p:first-child').filter({ hasText: /^\d{1,2}$/ });
const lichDangMo = async (page: Page) => tieuDeThang(page).first().isVisible().catch(() => false);

// Mũi tên ">" không có tên/văn bản trong cây truy cập (snapshot không thấy), nên bấm theo toạ độ:
// cùng hàng với tiêu đề tháng cuối, sát mép phải khung lịch. Thử vài vị trí, thành công khi tiêu đề tháng đổi.
// Nếu vẫn không chuyển được, dùng codegen để lấy locator thật rồi thay hàm này.
async function chuyenThangSau(page: Page): Promise<boolean> {
  const truoc = (await tieuDeThang(page).allInnerTexts()).join('|');
  const khung = page
    .locator('div')
    .filter({ has: tieuDeThang(page).first() })
    .filter({ has: page.getByText('Hiển thị lịch âm') })
    .last();
  const hop = await khung.boundingBox();
  const tieuDe = await tieuDeThang(page).last().boundingBox();
  if (!hop || !tieuDe) return false;
  const y = tieuDe.y + tieuDe.height / 2;
  for (const lui of [14, 22, 30, 40, 8]) {
    await page.mouse.click(hop.x + hop.width - lui, y);
    await page.waitForTimeout(400);
    if ((await tieuDeThang(page).allInnerTexts()).join('|') !== truoc) return true;
  }
  return false;
}

// Chọn Hà Nội → Hải Phòng (lịch tự mở), rồi chuyển tháng đến khi không chuyển tiếp được
async function moLichDenThangCuoi(page: Page) {
  await page.goto('https://vexere.com/');
  const closeButton = page.getByRole('button', { name: 'close' });
  if (await closeButton.isVisible().catch(() => false)) {
    await closeButton.click();
  }
  await page.getByText('Nơi xuất phát').click();
  await page.getByTestId('SearchWidget.from').fill('Hà Nội');
  await page.getByRole('paragraph').filter({ hasText: /^Hà Nội(, [^,]+)?$/ }).filter({ visible: true }).first().click();
  await page.getByText('Nơi đến').click();
  await page.getByTestId('SearchWidget.to').fill('Hải Phòng');
  await page.getByRole('paragraph').filter({ hasText: /^Hải Phòng(, [^,]+)?$/ }).filter({ visible: true }).first().click();
  if (!(await lichDangMo(page))) {
    await page.getByRole('paragraph').filter({ hasText: 'Ngày đi' }).first().click();
  }
  await expect(tieuDeThang(page).first()).toBeVisible();

  let soLan = 0;
  while (soLan < 24 && (await chuyenThangSau(page))) soLan++;
  expect(soLan, 'Không chuyển được sang tháng sau: lấy locator mũi tên bằng codegen rồi sửa hàm chuyenThangSau').toBeGreaterThan(0);
  return tieuDeThang(page).allInnerTexts();
}

test('TC-SEARCH-029 - Xác định và kiểm tra ngày đi xa nhất chọn được', async ({ page }) => {
  // 1-4. Truy cập, đóng popup, chọn Hà Nội → Hải Phòng, mở lịch và chuyển đến tháng cuối cùng
  const cacThang = await moLichDenThangCuoi(page);
  console.log(`Các tháng đang hiển thị ở cuối lịch: ${cacThang.join(' | ')}`);

  // 5. Tìm ngày cuối cùng chọn được (D_max): duyệt từ ô cuối lịch ngược về, ô đầu tiên bấm vào mà lịch đóng lại
  const cacO = cacONgay(page);
  const tong = await cacO.count();
  const cacSo: number[] = [];
  for (let i = 0; i < tong; i++) cacSo.push(Number((await cacO.nth(i).innerText()).trim()));

  let chiSoDMax = -1;
  for (let i = tong - 1; i >= 0; i--) {
    await cacO.nth(i).click({ timeout: 2000 }).catch(() => {});
    if (!(await lichDangMo(page))) { chiSoDMax = i; break; }
  }
  expect(chiSoDMax, 'Không tìm thấy ngày nào chọn được ở các tháng cuối').toBeGreaterThanOrEqual(0);

  // Tháng của D_max: số ngày tăng khi duyệt ngược nghĩa là đã sang tháng trước
  let chiSoThang = cacThang.length - 1;
  for (let i = tong - 1; i > chiSoDMax; i--) if (cacSo[i] < cacSo[i - 1]) chiSoThang--;
  const m = cacThang[chiSoThang].match(/(\d{1,2}), (\d{4})/)!;
  const dMax = new Date(Number(m[2]), Number(m[1]) - 1, cacSo[chiSoDMax]);
  const homNay = new Date(); homNay.setHours(0, 0, 0, 0);
  const soNgay = Math.round((dMax.getTime() - homNay.getTime()) / 86400000);
  const moTa = `${dMax.toLocaleDateString('vi-VN')} (hôm nay + ${soNgay} ngày)`;
  console.log(`D_max = ${moTa}  → điền vào ô B7 sheet BVA_TIM_CHUYEN`);
  test.info().annotations.push({ type: 'D_max', description: moTa });

  // 6a. D_max: tìm kiếm được tiếp nhận
  await Promise.all([
    page.waitForURL(url => url.pathname !== '/', { timeout: 30000, waitUntil: 'commit' }),
    page.getByTestId('SearchWidget.search').click({ noWaitAfter: true }),
  ]);

  // 6b. D_max - 1 chọn được (nếu cùng tháng với D_max) và D_max + 1 là ngày xám, không chọn được (nếu cùng tháng)
  await moLichDenThangCuoi(page);
  if (chiSoDMax >= 1 && cacSo[chiSoDMax - 1] === cacSo[chiSoDMax] - 1) {
    await cacONgay(page).nth(chiSoDMax - 1).click();
    expect(await lichDangMo(page), 'D_max - 1 phải chọn được (lịch đóng lại)').toBe(false);
  }
  if (chiSoDMax + 1 < tong && cacSo[chiSoDMax + 1] === cacSo[chiSoDMax] + 1) {
    await moLichDenThangCuoi(page);
    await cacONgay(page).nth(chiSoDMax + 1).click({ timeout: 2000 }).catch(() => {});
    expect(await lichDangMo(page), 'D_max + 1 là ngày xám: không chọn được (lịch vẫn mở)').toBe(true);
  }

  // 7. Chụp ảnh minh chứng
  await page.screenshot({
    path: path.join(__dirname, '../search/screenshots/TC-SEARCH-029-PASS.png'),
    fullPage: true
  });

});
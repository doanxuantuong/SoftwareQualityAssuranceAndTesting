import { test, expect, Page } from '@playwright/test';



async function dongPopup(page: Page) {
  const closeButton = page.getByRole('button', { name: 'close' });
  if (await closeButton.isVisible().catch(() => false)) {
    await closeButton.click();
  }
  const btnChapNhan = page.getByRole('button', { name: 'Chấp nhận tất cả' });
  if (await btnChapNhan.isVisible().catch(() => false)) {
    await btnChapNhan.click();
  }
}

// Tìm chuyến Vĩnh Long -> Sài Gòn khứ hồi và chọn ghế cho CẢ 2 CHIỀU.
// TODO: thay locator theo đúng flow thật của tuyến này (lấy từ codegen).
async function datChuyenKhuHoi(page: Page) {
  await page.goto('https://vexere.com/');
  await dongPopup(page);

  // TODO: chọn "Điểm đi" = Vĩnh Long
  await page.getByTestId('SearchWidget.from').click();
  // await page.locator('div').filter({ hasText: /^Vĩnh Long$/ }).first().click();

  // TODO: chọn "Điểm đến" = Sài Gòn / TP. Hồ Chí Minh
  await page.getByTestId('SearchWidget.to').click();
  // await page.getByRole('paragraph').filter({ hasText: 'Sài Gòn' }).click();

  // TODO: bật "Thêm ngày về" và chọn ngày đi / ngày về hợp lệ (ngày tương lai)
  // await page.getByText('addThêm ngày về').click();
  // await page.getByText('<ngày đi>').click();
  // await page.getByText('<ngày về>').click();

  await page.getByTestId('SearchWidget.search').click();
  await dongPopup(page);

  // --- Chọn ghế CHIỀU ĐI ---
  await page.getByRole('button', { name: 'Chọn chỗ' }).first().click();
  // TODO: chọn đúng ghế còn trống chiều đi, ghi lại mã ghế để so sánh ở bước 2
  // await page.locator('circle').nth(2).click();
  await page.getByRole('button', { name: 'Tiếp tục' }).click();

  // Một số luồng có thêm bước chọn điểm đón/trả chiều đi -> bấm Tiếp tục nếu có
  const btnTiepTuc = page.getByRole('button', { name: 'Tiếp tục' });
  if (await btnTiepTuc.isVisible().catch(() => false)) {
    await btnTiepTuc.click();
  }

  // --- Chọn ghế CHIỀU VỀ ---
  await page.getByRole('button', { name: 'Chọn chỗ' }).first().click();
  // TODO: chọn đúng ghế còn trống chiều về
  // await page.locator('circle').nth(2).click();
  await page.getByRole('button', { name: 'Tiếp tục' }).click();
}

// ---------- TC-BOOK-020 (phần chính: bước 1-6) ----------

test('TC-BOOK-020 - Giữ dữ liệu khi bấm Quay lại và khi F5 ở màn liên hệ', async ({ page }) => {
  // Bước 1: Chọn chuyến xe, ghế và điểm đón/trả hợp lệ (khứ hồi)
  await datChuyenKhuHoi(page);

  // Đến đây đang ở bước chọn điểm đón/trả CHIỀU VỀ (tuỳ giao diện thực tế)
  // TODO: xác nhận đang ở đúng màn "điểm đón/trả chiều về"
  // await expect(page.getByText('Điểm đón')).toBeVisible();

  // Bước 2: Tại bước chọn điểm đón/trả chiều về, nhấn Quay lại,
  // kiểm tra ghế đã chọn vẫn còn được giữ (không bị mất lựa chọn)
  await page.goBack();
  // TODO: thay bằng locator thật của ghế đã chọn ở chiều về
  // await expect(page.locator('circle.selected')).toHaveCount(1);

  // Bước 3: Nhấn Tiếp tục, kiểm tra dữ liệu điểm đón/trả nếu có được giữ nguyên
  await page.getByRole('button', { name: 'Tiếp tục' }).click();
  // TODO: nếu màn điểm đón/trả có lưu lựa chọn trước đó, assert tại đây
  // await expect(page.getByText('<điểm đón đã chọn trước đó>')).toBeVisible();
  await page.getByRole('button', { name: 'Tiếp tục' }).click();

  // Bước 4: Đến màn "Thông tin liên hệ", nhập dữ liệu hợp lệ
  const hoTen = 'Le Viet Khanh';
  const sdt = '0964429619';
  const email = 'cauvangnopro@gmail.com';

  await page.getByRole('textbox', { name: 'Họ và tên' }).fill(hoTen);
  await page.getByRole('textbox', { name: 'Số điện thoại' }).fill(sdt);
  await page.getByRole('textbox', { name: 'Email nhận thông tin' }).fill(email);

  // Bước 5: Quay lại rồi trở vào lại màn liên hệ, kiểm tra dữ liệu còn được giữ
  await page.goBack();
  await page.goForward();

  await expect(page.getByRole('textbox', { name: 'Họ và tên' })).toHaveValue(hoTen);
  await expect(page.getByRole('textbox', { name: 'Số điện thoại' })).toHaveValue(sdt);
  await expect(page.getByRole('textbox', { name: 'Email nhận thông tin' })).toHaveValue(email);

  // Bước 6: Nhấn F5 tại màn Thông tin liên hệ, quan sát phản hồi
  await page.reload();

  // Thực tế có thể xảy ra 1 trong 2 trường hợp hợp lệ: dữ liệu được giữ,
  // hoặc hệ thống quay về bước chọn chuyến có thông báo rõ ràng.
  // Điều KHÔNG được chấp nhận là lỗi trắng trang / crash không rõ nguyên nhân.
  const hoTenField = page.getByRole('textbox', { name: 'Họ và tên' });
  const coManHinhLienHe = await hoTenField.isVisible().catch(() => false);

  if (coManHinhLienHe) {
    const giaTri = await hoTenField.inputValue();
    console.log(`Sau F5: còn ở màn liên hệ, giá trị Họ và tên = "${giaTri}"`);
    // TODO: tuỳ hành vi thực tế mong muốn, bật 1 trong 2 dòng dưới:
    // expect.soft(giaTri).toBe(hoTen); // nếu yêu cầu giữ nguyên dữ liệu
    // expect.soft(giaTri).toBe('');    // nếu yêu cầu reset sau F5
  } else {
    console.log('Sau F5: hệ thống điều hướng ra khỏi màn liên hệ');
    // Phải không có lỗi hiển thị / trang trắng
    await expect(page.locator('body')).not.toContainText(/error|exception|undefined/i);
  }

  await page.screenshot({
    path: 'tests/booking/screenshots/TC-BOOK-020-step6-after-reload.png',
    fullPage: true,
  });
});

// ---------- TC-BOOK-020 (lượt thử riêng: bước 7) ----------

test('TC-BOOK-020 (F5 tại bước chọn điểm đón/trả) - Trang hiển thị phù hợp sau reload', async ({ page }) => {
  await datChuyenKhuHoi(page);

  // Đang ở bước chọn điểm đón/trả (chiều về) -> F5 ngay tại đây
  await page.reload();

  // Không được hiển thị lỗi xử lý ngoài dự kiến / trang trắng
  await expect(page.locator('body')).not.toContainText(/error|exception|undefined/i);

  // TODO: tuỳ hành vi mong muốn — có thể quay về trang tìm kiếm, hoặc giữ
  // nguyên bước đón/trả với hướng dẫn khôi phục rõ ràng. Ghi log để đối chiếu:
  console.log('URL sau F5 tại bước đón/trả:', page.url());

  await page.screenshot({
    path: 'tests/booking/screenshots/TC-BOOK-020-step7-reload-pickup.png',
    fullPage: true,
  });
});
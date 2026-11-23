import { test, expect, Locator } from '@playwright/test';
import path from 'path';

function ngaySau(soNgay: number) {
  const homNay = new Date();
  const ngay = new Date();
  ngay.setDate(ngay.getDate() + soNgay);
  return {
    ngay: ngay.getDate(),
    thangLech: (ngay.getFullYear() - homNay.getFullYear()) * 12
      + ngay.getMonth() - homNay.getMonth(),
    hienThi: ngay.toLocaleDateString('vi-VN'),
  };
}

// Chỉ đọc thông báo gắn với một trường, tránh lấy nhầm lỗi của trường khác.
async function docTrangThaiTruong(truong: Locator) {
  return truong.evaluate(el => {
    const input = el as HTMLInputElement;
    const hienThi = (node: Element) => node.getClientRects().length > 0
      && getComputedStyle(node).visibility !== 'hidden';
    const mauLoi = /vui lòng|bắt buộc|không.*(?:hợp lệ|được|hỗ trợ)|không để trống|chưa nhập|cần nhập|required|invalid|please enter/i;

    // Wrapper ngoài cùng chỉ chứa input này, trước khối chứa nhiều trường.
    let khung = input.parentElement;
    while (khung?.parentElement
      && khung.parentElement.querySelectorAll('input, textarea').length === 1) {
      khung = khung.parentElement;
    }

    const cacLoi: string[] = [];
    const them = (node: Element | null, laThongBaoLoi: boolean) => {
      if (!node || !hienThi(node)) return;
      const text = ((node as HTMLElement).innerText || node.textContent || '').trim();
      if (text && (laThongBaoLoi || mauLoi.test(text))) cacLoi.push(text);
    };
    for (const thuocTinh of ['aria-errormessage', 'aria-describedby']) {
      for (const id of (input.getAttribute(thuocTinh) || '').split(/\s+/).filter(Boolean)) {
        them(document.getElementById(id), thuocTinh === 'aria-errormessage');
      }
    }
    if (khung) {
      for (const node of Array.from(khung.querySelectorAll(
        '[role="alert"], .ant-form-explain, .ant-form-item-explain-error, '
        + '[class*="error-message"], [class*="ErrorMessage"], '
        + '[class*="error-text"], [class*="ErrorText"]',
      ))) them(node, true);
      // Một số ô dùng thẻ văn bản thường cho lỗi, không có role/class riêng.
      for (const node of Array.from(khung.querySelectorAll('p, span, small, div'))) {
        if (node.children.length === 0) them(node, false);
      }
    }
    return {
      giaTri: input.value,
      ariaInvalid: input.getAttribute('aria-invalid'),
      loi: Array.from(new Set(cacLoi)),
    };
  });
}

test('TC-BOOK-009 - Bỏ trống toàn bộ trường bắt buộc rồi bấm Tiếp tục', async ({ page }, testInfo) => {
  test.setTimeout(180000);
  page.setDefaultTimeout(15000);

  const ngayDi = ngaySau(3);
  const nhaXe = 'Anh Huy Travel';
  const soDienThoaiHopLe = '0912345678';
  const emailHopLe = 'vexere.tc009@example.com';
  let ketQua = 'FAIL';
  const kiemTraMem = expect.configure({ soft: true });
  const cacKiemTra: object[] = [];
  const thongBaoSdtMongDoi = 'Vui lòng nhập số điện thoại';
  const thongBaoSdtTrongBug = 'Số điện thoại không hợp lệ';
  let ketQuaBug002: object = { trangThai: 'NOT RUN', kyVong: thongBaoSdtMongDoi };
  let truocTiepTuc: object | null = null;
  let sauTiepTuc: object | null = null;
  const anh = (ten: string) => path.join(__dirname,
    `screenshots/TC-BOOK-009-${testInfo.project.name}-${ten}.png`);

  const khungDatVe = () => page.getByRole('button', { name: 'Đóng', exact: true })
    .filter({ visible: true }).first()
    .locator('xpath=ancestor::div[.//button[contains(@class,"footer-nextstep")]][1]');

  async function bamVaDongQuyDinh(nut: Locator, buocDich: Locator) {
    await nut.click();
    const dongY = page.getByText('Tôi đã đọc và đồng ý', { exact: true });
    await expect(buocDich.or(dongY).filter({ visible: true }).first())
      .toBeVisible({ timeout: 30000 });
    if (await dongY.isVisible()) {
      await dongY.click();
      await expect(dongY).toBeHidden();
      if (!(await buocDich.isVisible()) && await nut.isVisible()) await nut.click();
    }
    await expect(buocDich).toBeVisible({ timeout: 30000 });
  }

  async function bamTiepTucVaQuanSat(nut: Locator, urlBanDau: string) {
    const nutBiKhoa = await nut.isDisabled();
    if (nutBiKhoa) return { nutBiKhoa, daBam: false, daDoiTrang: false };
    // Theo dõi từ trước cú click, tránh kết luận quá sớm khi điều hướng còn đang chờ.
    const [daDoiTrang] = await Promise.all([
      page.waitForURL(url => url.href !== urlBanDau, { timeout: 5000 })
        .then(() => true, error => {
          if (error instanceof Error && error.name === 'TimeoutError') return false;
          throw error;
        }),
      nut.click(),
    ]);
    return { nutBiKhoa, daBam: true, daDoiTrang };
  }

  try {
    // 1. Tiền điều kiện: dùng cùng luồng đã chạy được ở TC002 để tới trang liên hệ.
    await page.addLocatorHandler(
      page.getByRole('dialog').filter({ hasText: /Sử dụng cookie/ })
        .getByRole('button', { name: 'close', exact: true }).first(),
      async nutDong => { await nutDong.click(); },
    );
    await page.goto('https://vexere.com/', { waitUntil: 'domcontentloaded' });
    await page.getByTestId('SearchWidget.from').waitFor({ state: 'visible' });
    await page.getByText('Nơi xuất phát', { exact: true }).click();
    await page.getByTestId('SearchWidget.from').fill('Hà Nội');
    await page.getByRole('paragraph').filter({ hasText: /^Hà Nội$/ }).first().click();
    await page.getByText('Nơi đến', { exact: true }).click();
    await page.getByTestId('SearchWidget.to').fill('Hải Phòng');
    await page.getByRole('paragraph').filter({ hasText: /^Hải Phòng$/ }).first().click();
    await page.locator('li > div > p:first-child', { hasText: new RegExp(`^${ngayDi.ngay}$`) })
      .nth(ngayDi.thangLech).click();
    await page.getByTestId('SearchWidget.search').click();

    const cacNutChonCho = page.getByRole('button', { name: 'Chọn chỗ', exact: true });
    await cacNutChonCho.first().waitFor({ state: 'visible', timeout: 30000 });
    let thongTinChuyen = '';
    for (let i = 0; i < await cacNutChonCho.count(); i++) {
      const nut = cacNutChonCho.nth(i);
      const text = await nut.evaluate(el => {
        let khung = el.parentElement;
        for (let j = 0; j < 15 && khung; j++, khung = khung.parentElement) {
          if (/Còn\s+\d+\s+chỗ trống/.test(khung.innerText)
            && /\d{1,2}:\d{2}/.test(khung.innerText)) return khung.innerText;
        }
        return '';
      });
      const soCho = Number(text.match(/Còn\s+(\d+)\s+chỗ trống/)?.[1] ?? 0);
      if (text.includes(nhaXe) && soCho > 0) {
        thongTinChuyen = text;
        await nut.click();
        break;
      }
    }
    test.skip(!thongTinChuyen, `Không thấy chuyến ${nhaXe} còn chỗ trong danh sách đang hiển thị.`);
    console.log(`TC-BOOK-009: Hà Nội → Hải Phòng; ${ngayDi.hienThi}; chưa đăng nhập.`, thongTinChuyen);

    // Chuẩn bị đúng 1 khách; giới hạn khách đã thuộc TC001.
    const boDem = khungDatVe().locator('.online-note-selection div[class*="QuantityInput"]').first();
    await expect(boDem).toBeVisible({ timeout: 20000 });
    const soKhachBanDau = Number((await boDem.innerText()).trim());
    expect(Number.isInteger(soKhachBanDau)).toBe(true);
    expect(soKhachBanDau).toBeGreaterThanOrEqual(0);
    expect(soKhachBanDau).toBeLessThanOrEqual(8);
    for (let i = soKhachBanDau; i < 1; i++) await boDem.locator('svg[class*="PlusIcon"]').click();
    for (let i = soKhachBanDau; i > 1; i--) await boDem.locator('svg[class*="SubIcon"]').click();
    await expect(boDem).toHaveText('1');

    const tiepTucChonCho = khungDatVe().locator('button.footer-nextstep[data-current="0"]')
      .filter({ visible: true }).first();
    const tiepTucDiemDonTra = khungDatVe().locator('button.footer-nextstep[data-current="1"]')
      .filter({ visible: true }).first();
    await bamVaDongQuyDinh(tiepTucChonCho, tiepTucDiemDonTra);
    for (const tenNhom of ['Điểm đón', 'Điểm trả']) {
      const nhom = khungDatVe().getByText(tenNhom, { exact: true })
        .locator('xpath=ancestor::div[.//input[@type="radio"] or .//*[@role="radio"]][1]');
      const cacRadio = nhom.getByRole('radio');
      await expect(cacRadio.first()).toBeVisible();
      if (await nhom.getByRole('radio', { checked: true }).count() === 0) await cacRadio.first().check();
      await expect(nhom.getByRole('radio', { checked: true })).toHaveCount(1);
    }

    const hoTen = page.locator('#userName');
    await bamVaDongQuyDinh(tiepTucDiemDonTra, hoTen);
    await expect(page).toHaveURL(/\/bookingconfirmation(?:[/?#]|$)/, { timeout: 30000 });
    const urlLienHe = page.url();
    const nhanHoTen = page.locator('label[for="userName"]').filter({ visible: true });
    // Đây là nhãn của textbox; placeholder thật chỉ là một dấu cách.
    const dienThoai = page.getByRole('textbox', { name: 'Số điện thoại', exact: true });
    const email = page.getByRole('textbox', { name: 'Email nhận thông tin', exact: true });
    const tiepTucLienHe = page.getByRole('button', { name: /^Tiếp tục(?:\s|$)/i })
      .filter({ visible: true });
    await expect(hoTen).toBeVisible();
    await expect(dienThoai).toBeVisible();
    await expect(email).toBeVisible();
    await expect(tiepTucLienHe).toHaveCount(1);

    async function docConTro() {
      return page.evaluate(() => {
        const el = document.activeElement;
        return el ? { the: el.tagName, id: el.id, ten: el.getAttribute('name'),
          loai: el.getAttribute('type'), ariaLabel: el.getAttribute('aria-label') } : null;
      });
    }

    async function docBaTruong() {
      return {
        hoTen: await docTrangThaiTruong(hoTen),
        soDienThoai: await docTrangThaiTruong(dienThoai),
        email: await docTrangThaiTruong(email),
      };
    }

    // 2. Bắt đầu từ dữ liệu hợp lệ để việc xóa cả ba ô không dùng nhầm lỗi cũ.
    await hoTen.fill('khanh lê viết');
    await dienThoai.fill(soDienThoaiHopLe);
    await email.fill(emailHopLe);
    await expect(nhanHoTen).toHaveCount(1);
    await nhanHoTen.click();
    for (const truong of [hoTen, dienThoai, email]) {
      await expect.poll(async () => (await docTrangThaiTruong(truong)).loi,
        'Tiền điều kiện: cả ba trường mẫu phải hợp lệ, không có cảnh báo cũ').toEqual([]);
      await expect.poll(async () => (await docTrangThaiTruong(truong)).ariaInvalid).not.toBe('true');
    }
    await expect(tiepTucLienHe).toBeEnabled();

    // 3. Xóa sạch cả ba trường theo TC009/BUG-002, kể cả email được tự điền.
    await hoTen.fill('');
    await dienThoai.fill('');
    await email.fill('');
    // Khi Họ tên rỗng, floating label nằm trên input và chặn click vào giữa ô.
    // Click chính nhãn liên kết để chuyển focus bình thường, không dùng force.
    await nhanHoTen.click();
    await expect(hoTen, 'Click nhãn Họ và tên phải chuyển focus ra khỏi email').toBeFocused();
    for (const truong of [hoTen, dienThoai, email]) {
      await expect(truong, 'Phải thực sự để trống cả ba trường').toHaveValue('');
    }
    truocTiepTuc = { ...await docBaTruong(), conTro: await docConTro(),
      nutTiepTucBiKhoa: await tiepTucLienHe.isDisabled() };
    console.log('TC-BOOK-009 - Trước Tiếp tục, cả ba trường rỗng:', truocTiepTuc);
    await page.screenshot({ path: anh('ALL-EMPTY-BEFORE-CONTINUE'), fullPage: true });

    // 4. Chỉ bấm khi giao diện cho phép. Nút disabled không được force-click hoặc gọi submit giả.
    const dieuHuong = await bamTiepTucVaQuanSat(tiepTucLienHe, urlLienHe);
    if (dieuHuong.daDoiTrang || !(await hoTen.isVisible())
      || !(await dienThoai.isVisible()) || !(await email.isVisible())) {
      cacKiemTra.push({ buoc: 'STAY-CONTACT', trangThai: 'FAIL', url: page.url(), ...dieuHuong });
      await page.screenshot({ path: anh('UNEXPECTED-NAVIGATION-FAIL'), fullPage: true });
    }
    expect(dieuHuong.daDoiTrang, 'Cả ba trường rỗng không được chuyển sang thanh toán').toBe(false);
    await expect(page).toHaveURL(urlLienHe);
    for (const truong of [hoTen, dienThoai, email]) {
      await expect(truong, 'Vẫn phải hiển thị các ô nhập trên trang liên hệ').toBeVisible();
      await expect(truong, 'Dữ liệu phải tiếp tục để trống sau thao tác Tiếp tục').toHaveValue('');
    }
    cacKiemTra.push({ buoc: 'STAY-CONTACT', trangThai: 'PASS', ...dieuHuong });

    // 5. Lỗi phải gắn riêng với từng trường, không lấy cảnh báo của ô khác thay thế.
    for (const { ten, truong } of [
      { ten: 'Họ tên', truong: hoTen },
      { ten: 'Số điện thoại', truong: dienThoai },
      { ten: 'Email', truong: email },
    ]) {
      const soLoiTruoc = testInfo.errors.length;
      await kiemTraMem.poll(async () => (await docTrangThaiTruong(truong)).loi.length,
        ten + ' rỗng phải có thông báo lỗi riêng').toBeGreaterThan(0);
      const trangThai = testInfo.errors.length === soLoiTruoc ? 'PASS' : 'FAIL';
      const thucTe = await docTrangThaiTruong(truong);
      cacKiemTra.push({ buoc: 'REQUIRED-FIELD', ten, trangThai, ...thucTe });
      console.log('TC-BOOK-009 - Cảnh báo từng trường:', { ten, trangThai, ...thucTe });
    }

    // 6. BUG-002: giữ đúng Expected Result trong Bug Log!F5.
    // Có lỗi định dạng KHÔNG thay thế được thông báo bắt buộc nhập khi SĐT rỗng.
    const soLoiTruocBug = testInfo.errors.length;
    await kiemTraMem.poll(async () => (await docTrangThaiTruong(dienThoai)).loi.join(' '),
      'BUG-002: SĐT rỗng phải báo Vui lòng nhập số điện thoại')
      .toContain(thongBaoSdtMongDoi);
    await kiemTraMem.poll(async () => (await docTrangThaiTruong(dienThoai)).loi.join(' '),
      'BUG-002: SĐT rỗng không được báo Số điện thoại không hợp lệ')
      .not.toContain(thongBaoSdtTrongBug);

    const cacTruongSau = await docBaTruong();
    const loiSdt = cacTruongSau.soDienThoai.loi.join(' ');
    const taiHienBug = loiSdt.includes(thongBaoSdtTrongBug);
    const dungThongBao = loiSdt.includes(thongBaoSdtMongDoi) && !taiHienBug;
    ketQuaBug002 = {
      trangThai: taiHienBug ? 'REPRODUCED' : dungThongBao ? 'NOT REPRODUCED' : 'CHƯA ĐỦ CĂN CỨ',
      ketQuaKiemTra: testInfo.errors.length === soLoiTruocBug ? 'PASS' : 'FAIL',
      kyVong: thongBaoSdtMongDoi, thucTe: cacTruongSau.soDienThoai.loi,
      ...dieuHuong,
      ghiChu: dieuHuong.daBam
        ? 'Đã bấm Tiếp tục và đối chiếu thông báo SĐT.'
        : 'Nút Tiếp tục bị khóa; đối chiếu các cảnh báo trên luồng UI hiện tại, không kết luận bug đã được sửa.',
    };
    cacKiemTra.push({ buoc: 'BUG-002-MESSAGE', ...ketQuaBug002 });
    if (taiHienBug) {
      testInfo.annotations.push({ type: 'BUG-002', description:
        'Tái hiện: cả ba trường rỗng nhưng SĐT báo Số điện thoại không hợp lệ, sai Expected Result.' });
    }
    console.log('TC-BOOK-009 - Kết quả đối chiếu BUG-002:', ketQuaBug002);

    // 7. Không có thông báo lỗi hệ thống; lỗi kiểm tra dữ liệu của ba ô là phản hồi bình thường.
    const soLoiTruocHeThong = testInfo.errors.length;
    const thongBaoHeThong = page.getByRole('dialog')
      .or(page.getByRole('alert'))
      .or(page.locator('.ant-modal-wrap, .ant-message-notice, .ant-notification-notice'))
      .filter({ hasText: /đã có lỗi xảy ra|có lỗi xảy ra|lỗi hệ thống|lỗi xử lý|something went wrong|application error|internal server error/i })
      .filter({ visible: true });
    await kiemTraMem(thongBaoHeThong, 'Không được xuất hiện thông báo lỗi hệ thống').toHaveCount(0);
    const loiHeThong = await thongBaoHeThong.allTextContents();
    cacKiemTra.push({ buoc: 'NO-SYSTEM-ERROR',
      trangThai: testInfo.errors.length === soLoiTruocHeThong ? 'PASS' : 'FAIL', loiHeThong });

    // G10 yêu cầu quan sát con trỏ nhưng không quy định phải focus ô nào.
    // Lưu nguyên trạng, không tự đặt điều kiện bắt buộc focus Họ tên.
    sauTiepTuc = { ...cacTruongSau, conTro: await docConTro(), ...dieuHuong, loiHeThong };
    console.log('TC-BOOK-009 - Sau Tiếp tục:', sauTiepTuc);
    await page.screenshot({ path: anh('ALL-EMPTY-AFTER-CONTINUE'), fullPage: true });
    ketQua = testInfo.errors.length === 0 ? 'PASS' : 'FAIL';
    console.log('TC-BOOK-009 - Kết quả automation:', ketQua);
    console.log('Lưu ý: TC009 đánh giá cả ba trường rỗng (R8). Các tổ hợp hai trường sai '
      + 'thuộc DT-BOOK-008-05, chưa triển khai trong file này.');
    // Dừng ở trang liên hệ; không tạo luồng thanh toán.
  } catch (error) {
    ketQua = testInfo.expectedStatus === 'skipped' && testInfo.errors.length === 0 ? 'SKIP' : 'FAIL';
    throw error;
  } finally {
    await testInfo.attach('TC-BOOK-009-ket-qua', {
      body: Buffer.from(JSON.stringify({ ketQuaAutomation: ketQua, nhaXe, ngayDi: ngayDi.hienThi,
        tuyen: 'Hà Nội → Hải Phòng', dangNhap: false, cacKiemTra,
        ketQuaBug002, truocTiepTuc, sauTiepTuc }, null, 2), 'utf8'),
      contentType: 'application/json',
    });
    if (!page.isClosed()) await page.screenshot({ path: anh(ketQua), fullPage: true });
  }
});

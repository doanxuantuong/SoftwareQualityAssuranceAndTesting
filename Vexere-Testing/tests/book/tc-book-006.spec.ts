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

test('TC-BOOK-006 - Nhập email nhận thông tin', async ({ page }, testInfo) => {
  test.setTimeout(180000);
  page.setDefaultTimeout(15000);

  const ngayDi = ngaySau(3);
  const nhaXe = 'Anh Huy Travel';
  const soDienThoaiHopLe = '0912345678';
  const emailHopLe = 'vexere.tc006@example.com';
  let ketQua = 'FAIL';
  const kiemTraMem = expect.configure({ soft: true });
  const cacKiemTra: object[] = [];
  let emailBanDau: string | null = null;
  const ghiChuYeuCau = [
    'Email rỗng: Test Cases!E8 ghi E-mail không hợp lệ; I8/EP-EM-04 yêu cầu có lỗi, '
      + 'EXE-004 ghi Vui lòng nhập địa chỉ E-mail. Chấp nhận hai thông báo đã ghi nhận, cần thống nhất wording.',
    'Chỉ quan sát email có sẵn; nguồn tự điền thuộc TC023, không bắt buộc có email trong phiên chưa đăng nhập.',
  ];
  const anh = (ten: string) => path.join(__dirname,
    `screenshots/TC-BOOK-006-${testInfo.project.name}-${ten}.png`);

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
    if (nutBiKhoa) return { nutBiKhoa, daDoiTrang: false };
    // Theo dõi từ trước cú click, tránh kết luận quá sớm khi điều hướng còn đang chờ.
    const [daDoiTrang] = await Promise.all([
      page.waitForURL(url => url.href !== urlBanDau, { timeout: 5000 })
        .then(() => true, error => {
          if (error instanceof Error && error.name === 'TimeoutError') return false;
          throw error;
        }),
      nut.click(),
    ]);
    return { nutBiKhoa, daDoiTrang };
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
    console.log(`TC-BOOK-006: Hà Nội → Hải Phòng; ${ngayDi.hienThi}; chưa đăng nhập.`, thongTinChuyen);

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
    // Đây là nhãn của textbox; placeholder thật chỉ là một dấu cách.
    const dienThoai = page.getByRole('textbox', { name: 'Số điện thoại', exact: true });
    const email = page.getByRole('textbox', { name: 'Email nhận thông tin', exact: true });
    const tiepTucLienHe = page.getByRole('button', { name: /^Tiếp tục(?:\s|$)/i })
      .filter({ visible: true });
    await expect(hoTen).toBeVisible();
    await expect(dienThoai).toBeVisible();
    await expect(email).toBeVisible();
    await expect(tiepTucLienHe).toHaveCount(1);

    // 2. Ghi nhận giá trị ban đầu; không ép phiên mới phải có email của lần khảo sát cũ.
    emailBanDau = await email.inputValue();
    console.log('TC-BOOK-006 - Email có sẵn khi mở form:', { giaTri: emailBanDau });
    await page.screenshot({ path: anh('INITIAL'), fullPage: true });
    testInfo.annotations.push({ type: 'GHI CHÚ YÊU CẦU', description: ghiChuYeuCau.join(' ') });

    // Tên và SĐT hợp lệ là tiền điều kiện để cô lập lỗi email trong R4.
    await hoTen.fill('khanh lê viết');
    await dienThoai.fill(soDienThoaiHopLe);
    await hoTen.click();
    for (const truong of [hoTen, dienThoai]) {
      await expect.poll(async () => (await docTrangThaiTruong(truong)).loi,
        'Tiền điều kiện: họ tên và SĐT phải hợp lệ').toEqual([]);
      await expect.poll(async () => (await docTrangThaiTruong(truong)).ariaInvalid).not.toBe('true');
    }

    async function nhapEmailVaRoiO(giaTri: string) {
      await email.fill(giaTri);
      await hoTen.click();
    }

    async function chuanBiEmailHopLe() {
      // Phải hết lỗi cũ trước khi thử mẫu sai tiếp theo, tránh PASS nhờ cảnh báo còn lại.
      await nhapEmailVaRoiO(emailHopLe);
      await expect(email).toHaveValue(emailHopLe);
      await expect.poll(async () => (await docTrangThaiTruong(email)).loi,
        'Chuẩn bị: email hợp lệ phải không còn cảnh báo').toEqual([]);
      await expect.poll(async () => (await docTrangThaiTruong(email)).ariaInvalid).not.toBe('true');
    }

    async function luuKiemTra(ten: string, duLieu: string, soLoiTruoc: number, chiTiet: object = {}) {
      const trangThai = testInfo.errors.length === soLoiTruoc ? 'PASS' : 'FAIL';
      const quanSat = { buoc: ten, duLieu, trangThai,
        ...await docTrangThaiTruong(email), ...chiTiet };
      cacKiemTra.push(quanSat);
      console.log('Kiểm tra email:', quanSat);
      await page.screenshot({ path: anh(ten + '-' + trangThai), fullPage: true });
    }

    async function kiemTraEmailSai(ten: string, duLieu: string) {
      await chuanBiEmailHopLe();
      const soLoiTruoc = testInfo.errors.length;
      await nhapEmailVaRoiO(duLieu);
      await kiemTraMem.poll(async () => (await docTrangThaiTruong(email)).loi.join(' '),
        ten + ': email sai định dạng phải báo E-mail không hợp lệ')
        .toMatch(/e-?mail không hợp lệ/i);
      await luuKiemTra(ten, duLieu, soLoiTruoc);
    }

    // 3. Rỗng: theo I8/EP-EM-04 phải có cảnh báo; lưu nguyên thông báo thực tế.
    await chuanBiEmailHopLe();
    let soLoiTruoc = testInfo.errors.length;
    await nhapEmailVaRoiO('');
    await kiemTraMem(email, 'Phải xóa sạch email trước khi kiểm tra rỗng').toHaveValue('');
    await kiemTraMem.poll(async () => (await docTrangThaiTruong(email)).loi.join(' '),
      'Email rỗng phải có thông báo lỗi theo các cách ghi nhận trong Excel')
      .toMatch(/vui lòng nhập địa chỉ e-?mail|e-?mail không hợp lệ/i);
    await luuKiemTra('EMPTY', '', soLoiTruoc);

    // 4. Thiếu tên miền sau @, rồi nhập lại email đúng theo G8.
    await kiemTraEmailSai('MISSING-DOMAIN', 'abc@');
    soLoiTruoc = testInfo.errors.length;
    await nhapEmailVaRoiO(emailHopLe);
    await kiemTraMem(email, 'Email đúng phải được giữ nguyên').toHaveValue(emailHopLe);
    await kiemTraMem.poll(async () => (await docTrangThaiTruong(email)).loi,
      'Email đúng định dạng phải được chấp nhận').toEqual([]);
    await kiemTraMem.poll(async () => (await docTrangThaiTruong(email)).ariaInvalid).not.toBe('true');
    await kiemTraMem(tiepTucLienHe, 'Các trường hợp lệ thì nút Tiếp tục được bật').toBeEnabled();
    await luuKiemTra('VALID', emailHopLe, soLoiTruoc);

    // 5. Các phân lớp sai còn lại từ Test Data, EP_DATVE và EXE-004.
    const cacEmailSai = [
      { ten: 'MISSING-LOCAL', giaTri: '@gmail.com' },
      { ten: 'MULTIPLE-AT', giaTri: 'abc@@gmail.com' },
      { ten: 'INTERNAL-SPACE', giaTri: 'abc @gmail.com' },
      { ten: 'MISSING-TLD', giaTri: 'abc@gmail' },
      { ten: 'NO-AT', giaTri: '1231313' },
    ];
    for (const duLieu of cacEmailSai) {
      await kiemTraEmailSai(duLieu.ten, duLieu.giaTri);
    }

    // 6. Decision Table R4: chỉ email sai (1231313), họ tên và SĐT hợp lệ.
    soLoiTruoc = testInfo.errors.length;
    const dieuHuongR4 = await bamTiepTucVaQuanSat(tiepTucLienHe, urlLienHe);
    if (dieuHuongR4.daDoiTrang || !(await email.isVisible())) {
      cacKiemTra.push({ buoc: 'R4', trangThai: 'FAIL', urlThucTe: page.url(), ...dieuHuongR4 });
      await page.screenshot({ path: anh('R4-FAIL'), fullPage: true });
    }
    expect(dieuHuongR4.daDoiTrang, 'R4: email sai không được chuyển sang bước thanh toán').toBe(false);
    await expect(email, 'R4: phải còn ở trang liên hệ').toBeVisible();
    await expect(page).toHaveURL(urlLienHe);
    await kiemTraMem.poll(async () => (await docTrangThaiTruong(email)).loi.join(' '),
      'R4: cảnh báo phải thuộc trường Email').toMatch(/e-?mail không hợp lệ/i);
    for (const truong of [hoTen, dienThoai]) {
      await kiemTraMem.poll(async () => (await docTrangThaiTruong(truong)).loi,
        'R4: họ tên và SĐT hợp lệ không được báo lỗi').toEqual([]);
      await kiemTraMem.poll(async () => (await docTrangThaiTruong(truong)).ariaInvalid).not.toBe('true');
    }
    await luuKiemTra('R4', '1231313', soLoiTruoc, dieuHuongR4);

    // Khôi phục email hợp lệ để kết thúc ở trang liên hệ; không bấm Tiếp tục khi cả form hợp lệ.
    await chuanBiEmailHopLe();
    ketQua = testInfo.errors.length === 0 ? 'PASS' : 'FAIL';
    console.log('TC-BOOK-006 - Kết quả automation:', ketQua);
    console.log('Ghi chú đối chiếu Excel:', ghiChuYeuCau.join(' '));
  } catch (error) {
    ketQua = testInfo.expectedStatus === 'skipped' && testInfo.errors.length === 0 ? 'SKIP' : 'FAIL';
    throw error;
  } finally {
    await testInfo.attach('TC-BOOK-006-ket-qua', {
      body: Buffer.from(JSON.stringify({ ketQuaAutomation: ketQua, nhaXe, ngayDi: ngayDi.hienThi,
        tuyen: 'Hà Nội → Hải Phòng', dangNhap: false, emailBanDau,
        cacKiemTra, ghiChuYeuCau }, null, 2), 'utf8'),
      contentType: 'application/json',
    });
    if (!page.isClosed()) await page.screenshot({ path: anh(ketQua), fullPage: true });
  }
});

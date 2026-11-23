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

// Chỉ đọc thông báo gắn với một trường, tránh lấy nhầm lỗi điện thoại/email.
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

test('TC-BOOK-005 - Nhập số điện thoại liên hệ', async ({ page }, testInfo) => {
  test.setTimeout(240000);
  page.setDefaultTimeout(15000);

  const ngayDi = ngaySau(3);
  const nhaXe = 'Anh Huy Travel';
  const soDienThoaiHopLe = '0912345678';
  const emailHopLe = 'vexere.tc005@example.com';
  let ketQua = 'FAIL';
  const kiemTraMem = expect.configure({ soft: true });
  const cacKiemTra: object[] = [];
  const cacQuanSat: object[] = [];
  let ketQuaBug003: object = { trangThai: 'NOT RUN' };
  const choXacNhan = ['L_min/L_max và cách tính độ dài sau mã +84',
    'Cách xử lý dấu gạch và khoảng trắng trong số điện thoại'];
  const anh = (ten: string) => path.join(__dirname,
    `screenshots/TC-BOOK-005-${testInfo.project.name}-${ten}.png`);

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
    console.log(`TC-BOOK-005: Hà Nội → Hải Phòng; ${ngayDi.hienThi}; chưa đăng nhập.`, thongTinChuyen);

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
    await expect(page.getByRole('paragraph').filter({ hasText: /^\s*🇻🇳\s*\+84\s*$/ }),
      'Dùng mã quốc gia Việt Nam +84 theo Excel').toBeVisible();

    // Tên/email hợp lệ để lỗi quan sát được chỉ thuộc số điện thoại (R3).
    await hoTen.fill('khanh lê viết');
    await email.fill(emailHopLe);
    await hoTen.click();
    for (const truong of [hoTen, email]) {
      await expect.poll(async () => (await docTrangThaiTruong(truong)).loi,
        'Tiền điều kiện: họ tên và email phải hợp lệ').toEqual([]);
      await expect.poll(async () => (await docTrangThaiTruong(truong)).ariaInvalid).not.toBe('true');
    }

    async function nhapVaRoiO(giaTri: string) {
      await dienThoai.fill(giaTri);
      await hoTen.click();
    }

    async function chuanBiSoHopLe() {
      // Xóa lỗi của lần thử trước để không lấy nhầm cảnh báo cũ cho dữ liệu mới.
      await nhapVaRoiO(soDienThoaiHopLe);
      await expect(dienThoai).toHaveValue(soDienThoaiHopLe);
      await expect.poll(async () => (await docTrangThaiTruong(dienThoai)).loi,
        'Chuẩn bị: SĐT mẫu hợp lệ phải hết lỗi trước lần thử tiếp theo').toEqual([]);
      await expect.poll(async () => (await docTrangThaiTruong(dienThoai)).ariaInvalid).not.toBe('true');
    }

    async function luuKiemTra(ten: string, duLieu: string, soLoiTruoc: number, chiTiet: object = {}) {
      const trangThai = testInfo.errors.length === soLoiTruoc ? 'PASS' : 'FAIL';
      const quanSat = { buoc: ten, duLieu, trangThai,
        ...await docTrangThaiTruong(dienThoai), ...chiTiet };
      cacKiemTra.push(quanSat);
      console.log('Kiểm tra SĐT:', quanSat);
      await page.screenshot({ path: anh(ten + '-' + trangThai), fullPage: true });
    }

    async function kiemTraVanOTrangLienHe(tenBuoc: string, dieuHuong: { daDoiTrang: boolean }) {
      // Nếu số sai vẫn được chuyển bước, lưu bằng chứng và dừng, tránh lỗi locator dây chuyền.
      if (dieuHuong.daDoiTrang || !(await dienThoai.isVisible())) {
        cacKiemTra.push({ buoc: tenBuoc, trangThai: 'FAIL', urlThucTe: page.url(), ...dieuHuong });
        await page.screenshot({ path: anh(tenBuoc + '-FAIL'), fullPage: true });
      }
      expect(dieuHuong.daDoiTrang, tenBuoc + ': SĐT sai không được chuyển bước').toBe(false);
      await expect(dienThoai, tenBuoc + ': phải còn ở trang liên hệ').toBeVisible();
      await expect(page).toHaveURL(urlLienHe);
    }

    // 2. Rỗng: giữ đúng kỳ vọng trong Excel, không đổi theo thông báo lỗi đang quan sát.
    await chuanBiSoHopLe();
    let soLoiTruoc = testInfo.errors.length;
    await nhapVaRoiO('');
    const dieuHuongKhiRong = await bamTiepTucVaQuanSat(tiepTucLienHe, urlLienHe);
    await kiemTraVanOTrangLienHe('EMPTY', dieuHuongKhiRong);
    await kiemTraMem.poll(async () => (await docTrangThaiTruong(dienThoai)).loi.join(' '),
      'SĐT rỗng phải báo đúng: Vui lòng nhập số điện thoại')
      .toContain('Vui lòng nhập số điện thoại');
    await luuKiemTra('EMPTY', '', soLoiTruoc, dieuHuongKhiRong);

    // 3. Phân lớp dữ liệu không hợp lệ. Không tự suy ra min/max từ mẫu 13 chữ số.
    const duLieuSai = [
      { ten: 'LETTERS', giaTri: 'abcxyz' },
      { ten: 'LETTERS-AND-DIGITS', giaTri: 'abc0912345' },
      { ten: 'SPECIAL-CHAR', giaTri: '09@1234' },
      { ten: '13-DIGITS', giaTri: '0964429619123' },
    ];
    for (const duLieu of duLieuSai) {
      await chuanBiSoHopLe();
      soLoiTruoc = testInfo.errors.length;
      await nhapVaRoiO(duLieu.giaTri);
      if (duLieu.ten === '13-DIGITS') {
        await kiemTraMem.poll(async () => (await docTrangThaiTruong(dienThoai)).loi.join(' '),
          'Mẫu 13 chữ số phải báo Số điện thoại không hợp lệ theo Excel')
          .toContain('Số điện thoại không hợp lệ');
      } else {
        // Nếu ô tự lọc ký tự, giá trị sau lọc vẫn được ghi riêng trong kết quả.
        await kiemTraMem.poll(async () => (await docTrangThaiTruong(dienThoai)).loi.length,
          duLieu.ten + ': dữ liệu chứa chữ hoặc @ phải bị từ chối và có cảnh báo')
          .toBeGreaterThan(0);
      }
      await luuKiemTra(duLieu.ten, duLieu.giaTri, soLoiTruoc);
    }

    // 4. R3: đang giữ mẫu 13 chữ số, tên/email hợp lệ, bấm Tiếp tục.
    soLoiTruoc = testInfo.errors.length;
    const dieuHuongR3 = await bamTiepTucVaQuanSat(tiepTucLienHe, urlLienHe);
    await kiemTraVanOTrangLienHe('R3', dieuHuongR3);
    await kiemTraMem.poll(async () => (await docTrangThaiTruong(dienThoai)).loi.length,
      'R3: phải cảnh báo đúng trường Số điện thoại').toBeGreaterThan(0);
    for (const truong of [hoTen, email]) {
      await kiemTraMem.poll(async () => (await docTrangThaiTruong(truong)).loi,
        'R3: họ tên và email hợp lệ không được báo lỗi').toEqual([]);
      await kiemTraMem.poll(async () => (await docTrangThaiTruong(truong)).ariaInvalid).not.toBe('true');
    }
    await luuKiemTra('R3', '0964429619123', soLoiTruoc, dieuHuongR3);

    // 5. Mẫu hợp lệ dùng trong Excel/TC004; không quy định mọi số 10 chữ số đều hợp lệ.
    soLoiTruoc = testInfo.errors.length;
    await nhapVaRoiO(soDienThoaiHopLe);
    await kiemTraMem(dienThoai, 'Giữ đúng mẫu SĐT vừa nhập').toHaveValue(soDienThoaiHopLe);
    await kiemTraMem.poll(async () => (await docTrangThaiTruong(dienThoai)).loi,
      'SĐT mẫu hợp lệ phải được chấp nhận, cảnh báo cũ phải biến mất').toEqual([]);
    await kiemTraMem.poll(async () => (await docTrangThaiTruong(dienThoai)).ariaInvalid).not.toBe('true');
    await kiemTraMem(tiepTucLienHe, 'Các trường hợp lệ thì nút Tiếp tục được bật').toBeEnabled();
    await luuKiemTra('VALID', soDienThoaiHopLe, soLoiTruoc);

    // 6. Chỉ quan sát hai định dạng chưa có quy tắc. Không biến quan sát thành PASS/FAIL.
    testInfo.annotations.push({ type: 'CHỜ XÁC NHẬN', description: choXacNhan.join('; ') });
    for (const duLieu of [
      { ten: 'HYPHENS', giaTri: '091-234-5678' },
      { ten: 'SPACES', giaTri: '091 234 5678' },
    ]) {
      await chuanBiSoHopLe();
      await nhapVaRoiO(duLieu.giaTri);
      const quanSat = { buoc: duLieu.ten, duLieu: duLieu.giaTri,
        trangThai: 'CẦN XÁC NHẬN QUY TẮC', ...await docTrangThaiTruong(dienThoai),
        nutTiepTucBiKhoa: await tiepTucLienHe.isDisabled() };
      cacQuanSat.push(quanSat);
      console.log('Quan sát định dạng SĐT:', quanSat);
      await page.screenshot({ path: anh(duLieu.ten + '-OBSERVED'), fullPage: true });
    }

    // 7. BUG-003: sửa SĐT sai tại trang thanh toán (Bug Log!E6:G6, Hình 38/39).
    // Chuyển trang là tiền điều kiện của BUG-003, không thực hiện thanh toán.
    ketQuaBug003 = { trangThai: 'ĐANG CHUẨN BỊ TRANG THANH TOÁN' };
    await chuanBiSoHopLe();
    await hoTen.fill('khanh lê viết');
    await email.fill(emailHopLe);
    await hoTen.click();
    await expect(tiepTucLienHe).toBeEnabled();
    await tiepTucLienHe.click();

    const phuongThucThanhToan = page.getByText('Phương thức thanh toán', { exact: true });
    const chinhSachDuLieu = page.getByText('Chính sách bảo vệ dữ liệu cá nhân', { exact: true });
    await expect(phuongThucThanhToan.or(chinhSachDuLieu).filter({ visible: true }).first())
      .toBeVisible({ timeout: 30000 });
    if (await chinhSachDuLieu.isVisible()) {
      // Popup xuất hiện trong Hình 58; nút xác nhận thuộc popup, không phải nút thanh toán.
      const popupDuLieu = chinhSachDuLieu
        .locator('xpath=ancestor::*[.//button[normalize-space(.)="Xác nhận"]][1]');
      const dongYDuLieu = popupDuLieu.getByRole('checkbox').filter({ visible: true });
      if (await dongYDuLieu.count() > 0) {
        await expect(dongYDuLieu).toHaveCount(1);
        await dongYDuLieu.check();
      }
      await popupDuLieu.getByRole('button', { name: 'Xác nhận', exact: true }).click();
      await expect(chinhSachDuLieu).toBeHidden();
      if (!(await phuongThucThanhToan.isVisible()) && await tiepTucLienHe.isVisible()) {
        await tiepTucLienHe.click();
      }
    }
    await expect(phuongThucThanhToan).toBeVisible({ timeout: 30000 });
    await page.screenshot({ path: anh('BUG-003-PAYMENT'), fullPage: true });

    // SĐT tại trang thanh toán có thể hiển thị 9 số sau +84, như Hình 38.
    const chuanHoaSo = (giaTri: string) => {
      const so = giaTri.replace(/\D/g, '');
      if (so.length === 11 && so.startsWith('84')) return so.slice(2);
      if (so.length === 10 && so.startsWith('0')) return so.slice(1);
      return so;
    };
    const soCuChuanHoa = chuanHoaSo(soDienThoaiHopLe);
    const nganCach = '[\\s().-]*';
    const mauSoCu = new RegExp('(?:^|\\D)(?:(?:\\+?84|0)' + nganCach + ')?'
      + soCuChuanHoa.split('').join(nganCach) + '(?!\\d)');
    const tieuDeLienHeThanhToan = page.getByText('Thông tin liên hệ', { exact: true })
      .filter({ visible: true });
    await expect(tieuDeLienHeThanhToan.first()).toBeVisible();
    if (!(await page.getByText('Chỉnh sửa', { exact: true }).filter({ visible: true }).count())) {
      await tieuDeLienHeThanhToan.first().click();
    }

    // Ghim theo tiêu đề/email/nút sửa, không chọn container theo số đang kiểm tra.
    // Khi SĐT thay đổi sai, locator vẫn phải giữ đúng thẻ để assertion phát hiện được.
    const theLienHeDaLuu = page.locator('div, section, article')
      .filter({ has: page.getByText('Thông tin liên hệ', { exact: true }) })
      .filter({ has: page.getByText('Chỉnh sửa', { exact: true }) })
      .filter({ hasText: emailHopLe }).last();
    await expect(theLienHeDaLuu).toBeVisible();
    await expect(theLienHeDaLuu).toContainText(mauSoCu);
    const thongTinTruocSua = await theLienHeDaLuu.innerText();
    const nutChinhSua = theLienHeDaLuu.getByText('Chỉnh sửa', { exact: true });
    await expect(nutChinhSua).toHaveCount(1);
    await nutChinhSua.click();

    const nutCapNhat = page.getByRole('button', { name: 'Cập nhật', exact: true })
      .filter({ visible: true });
    await expect(nutCapNhat).toHaveCount(1);
    // Hình 38 là khung trượt bên phải; không mặc định nó có role dialog hay nút đóng X.
    const khungSuaLienHe = nutCapNhat.locator(
      'xpath=ancestor::*[.//input[not(@type="hidden") and not(@type="checkbox") and not(@type="radio")]][1]',
    );
    // Ô Họ tên có accessible name chứa cả các nhãn của form, gồm "Số điện thoại".
    // Khớp chính xác tên ô SĐT để không lấy nhầm ô Họ tên theo regex một phần.
    let soDienThoaiSua = khungSuaLienHe.getByRole('textbox', { name: 'Số điện thoại', exact: true });
    if (await soDienThoaiSua.count() === 0) {
      // Hỗ trợ giao diện chưa gắn label với input: tìm duy nhất ô chứa số đã lưu.
      const cacO = khungSuaLienHe.getByRole('textbox').filter({ visible: true });
      const cacViTri: number[] = [];
      for (let i = 0; i < await cacO.count(); i++) {
        if (chuanHoaSo(await cacO.nth(i).inputValue()) === soCuChuanHoa) cacViTri.push(i);
      }
      expect(cacViTri.length, 'Phải xác định duy nhất ô SĐT đang chỉnh sửa').toBe(1);
      soDienThoaiSua = cacO.nth(cacViTri[0]);
    }
    await expect(soDienThoaiSua).toHaveCount(1);
    await expect(soDienThoaiSua).toBeVisible();
    expect(chuanHoaSo(await soDienThoaiSua.inputValue()), 'Khung sửa phải mở đúng SĐT đã lưu')
      .toBe(soCuChuanHoa);
    await expect.poll(async () => (await docTrangThaiTruong(soDienThoaiSua)).loi,
      'Khung sửa phải bắt đầu từ SĐT hợp lệ, không có lỗi cũ').toEqual([]);

    const soSaiBug003 = 'ádadada12312313';
    soLoiTruoc = testInfo.errors.length;
    ketQuaBug003 = { trangThai: 'ĐANG KIỂM TRA', soSaiBug003, thongTinTruocSua };
    await soDienThoaiSua.fill(soSaiBug003);
    await soDienThoaiSua.blur();
    // Bug Log yêu cầu phản hồi sau Cập nhật, không bắt buộc lỗi xuất hiện ngay sau blur.
    const truocCapNhat = await docTrangThaiTruong(soDienThoaiSua);
    await page.screenshot({ path: anh('BUG-003-BEFORE-UPDATE'), fullPage: true });

    const nutCapNhatBiKhoa = await nutCapNhat.isDisabled();
    let khungSuaDaDong = false;
    if (!nutCapNhatBiKhoa) {
      // Theo dõi đóng khung từ trước click; chờ cả trường hợp yêu cầu cập nhật bất đồng bộ.
      [khungSuaDaDong] = await Promise.all([
        khungSuaLienHe.waitFor({ state: 'hidden', timeout: 5000 }).then(() => true, error => {
          if (error instanceof Error && error.name === 'TimeoutError') return false;
          throw error;
        }),
        nutCapNhat.click(),
      ]);
    }
    const loiNgoaiKhung = page.getByRole('alert')
      .or(page.locator('.ant-message-error, .ant-notification-notice-error'))
      .filter({ hasText: /số điện thoại|điện thoại không hợp lệ/i }).filter({ visible: true });
    async function docLoiSauCapNhat() {
      if (await soDienThoaiSua.isVisible()) return (await docTrangThaiTruong(soDienThoaiSua)).loi;
      return loiNgoaiKhung.allTextContents();
    }
    // Inline error đã đáp ứng Expected Result; không tự thêm điều kiện bắt buộc có toast.
    await kiemTraMem.poll(docLoiSauCapNhat,
      'BUG-003: sau Cập nhật phải còn phản hồi lỗi rõ ràng cho SĐT sai')
      .not.toEqual([]);
    await kiemTraMem(theLienHeDaLuu,
      'BUG-003: thông tin đã lưu phải giữ nguyên số cũ, không nhận số sai').toContainText(mauSoCu);
    await kiemTraMem(theLienHeDaLuu).not.toContainText(soSaiBug003);
    const thongTinSauSua = await theLienHeDaLuu.innerText();
    ketQuaBug003 = {
      trangThai: testInfo.errors.length === soLoiTruoc ? 'PASS' : 'FAIL',
      soSaiBug003, truocCapNhat, nutCapNhatBiKhoa, khungSuaDaDong,
      loiSauCapNhat: await docLoiSauCapNhat(), thongTinTruocSua, thongTinSauSua,
      ghiChu: 'Đánh giá theo Bug Log!F6: báo lỗi và không lưu SĐT sai. '
        + 'Nếu chỉ thiếu thông báo phụ nhưng vẫn có inline error và giữ số cũ, cần rà soát phân loại BUG-003.',
    };
    cacKiemTra.push({ buoc: 'BUG-003-PAYMENT-EDIT', ...ketQuaBug003 });
    console.log('Kết quả đối chiếu BUG-003:', ketQuaBug003);
    await page.screenshot({ path: anh('BUG-003-AFTER-UPDATE'), fullPage: true });

    // Không có L_min/L_max trong Excel nên chưa đánh giá các mốc BVA-BOOK-007..012.
    // Dừng tại trang thanh toán sau kiểm tra SĐT; không bấm nút Thanh toán.
    ketQua = testInfo.errors.length === 0 ? 'PASS' : 'FAIL';
    console.log('TC-BOOK-005 - Kết quả automation cho các kiểm tra đã có kỳ vọng:', ketQua);
    console.log('Phần chưa kết luận, cần ghi vào ghi chú báo cáo:', choXacNhan.join('; '));
  } catch (error) {
    ketQua = testInfo.expectedStatus === 'skipped' && testInfo.errors.length === 0 ? 'SKIP' : 'FAIL';
    throw error;
  } finally {
    await testInfo.attach('TC-BOOK-005-ket-qua', {
      body: Buffer.from(JSON.stringify({ ketQuaAutomation: ketQua, nhaXe, ngayDi: ngayDi.hienThi,
        tuyen: 'Hà Nội → Hải Phòng', dangNhap: false,
        cacKiemTra, cacQuanSat, ketQuaBug003, choXacNhan }, null, 2), 'utf8'),
      contentType: 'application/json',
    });
    if (!page.isClosed()) await page.screenshot({ path: anh(ketQua), fullPage: true });
  }
});

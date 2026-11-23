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

test('TC-BOOK-008 - Tiếp tục đặt vé sang trang thanh toán', async ({ page }, testInfo) => {
  test.setTimeout(240000);
  page.setDefaultTimeout(15000);

  const ngayDi = ngaySau(3);
  const nhaXe = 'Anh Huy Travel';
  const soDienThoaiHopLe = '0912345678';
  const emailHopLe = 'vexere.tc008@example.com';
  let ketQua = 'FAIL';
  const kiemTraMem = expect.configure({ soft: true });
  const cacKiemTra: object[] = [];
  const diemDaChon: Array<{ nhom: string; ten: string; gio: string }> = [];
  let doiChieuTien: object = { trangThai: 'NOT RUN' };
  const anh = (ten: string) => path.join(__dirname,
    `screenshots/TC-BOOK-008-${testInfo.project.name}-${ten}.png`);

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

  async function docDiem(radio: Locator) {
    const hang = radio.locator(
      'xpath=ancestor::*[count(.//input[@type="radio"] | .//*[@role="radio"])=1 and .//*[normalize-space(.)="Bản đồ"]][1]',
    );
    const cacDong = (await hang.innerText()).split('\n').map(d => d.trim()).filter(Boolean);
    const viTriGio = cacDong.findIndex(d => /\b\d{1,2}:\d{2}\b/.test(d));
    const gio = cacDong[viTriGio]?.match(/\b\d{1,2}:\d{2}\b/)?.[0];
    expect(gio, 'Điểm đã chọn phải có giờ đón/trả').toBeTruthy();
    const cacDongTen = [cacDong[viTriGio].replace(gio!, '').trim(), ...cacDong.slice(viTriGio + 1)];
    const ten = cacDongTen.find(d => /[0-9A-Za-zÀ-ỹ]/.test(d)
      && !/Lưu ý quan trọng|Bản đồ/i.test(d) && !/^(place|emoji)$/i.test(d));
    expect(ten, 'Điểm đã chọn phải có tên địa điểm').toBeTruthy();
    return { ten: ten!, gio: gio! };
  }

  async function docTienTheoNhan(nhan: Locator) {
    return nhan.evaluate(el => {
      const tenNhan = (el.textContent || '').trim();
      let khung: HTMLElement | null = el as HTMLElement;
      let text = '';
      for (let i = 0; i < 8 && khung; i++, khung = khung.parentElement) {
        text = khung.innerText;
        const viTri = text.indexOf(tenNhan);
        if (viTri < 0) continue;
        // Các chữ số động có thể xuống dòng. Chỉ đọc giá ngay sau đúng nhãn.
        const gia = text.slice(viTri + tenNhan.length)
          .match(/^\s*:?\s*(\d[\d.,\s]*)\s*[đ₫]/);
        if (gia) {
          const soTien = Number(gia[1].replace(/\D/g, ''));
          if (Number.isSafeInteger(soTien)) return { soTien, text };
        }
      }
      return { soTien: null, text };
    });
  }

  async function kiemTraThongTinChuyen(tenBuoc: string) {
    const soLoiTruoc = testInfo.errors.length;
    const khung = page.locator('div, section, article')
      .filter({ has: page.getByText('Thông tin chuyến đi', { exact: true }) })
      .filter({ has: page.getByText(nhaXe, { exact: true }) }).last();
    await expect(khung).toBeVisible();
    await kiemTraMem(khung.getByText(nhaXe, { exact: true })).toHaveCount(1);
    const [ngay, thang, nam] = ngayDi.hienThi.split('/').map(Number);
    const thanhPhan = (so: number) => so < 10 ? '0?' + so : String(so);
    const mauNgay = new RegExp('(?:^|\\D)' + thanhPhan(ngay) + '/'
      + thanhPhan(thang) + '/' + nam + '(?!\\d)');
    await kiemTraMem(khung, tenBuoc + ': đúng ngày khởi hành').toContainText(mauNgay);

    const coCotGio = './/*[translate(normalize-space(.), "0123456789", "") = ":" '
      + 'and (string-length(normalize-space(.)) = 4 or string-length(normalize-space(.)) = 5)]';
    for (const diem of diemDaChon) {
      const tenDiem = khung.getByText(diem.ten, { exact: true });
      await kiemTraMem(tenDiem, tenBuoc + ': giữ đúng ' + diem.nhom).toHaveCount(1);
      const hang = tenDiem.locator('xpath=ancestor::div[' + coCotGio + '][1]');
      await kiemTraMem(hang.getByText('Thay đổi', { exact: true }),
        tenBuoc + ': đối chiếu riêng từng điểm').toHaveCount(1);
      await kiemTraMem(hang.getByText(/^\d{1,2}:\d{2}$/),
        tenBuoc + ': giữ đúng giờ tại ' + diem.ten).toHaveText(diem.gio);
    }
    const bieuTuongKhach = khung.getByRole('img', { name: 'vex-person-gray-16', exact: true });
    await expect(bieuTuongKhach).toHaveCount(1);
    // Có thể có wrapper rỗng quanh icon; lấy khung gần nhất có chữ, không tìm theo số mong đợi.
    await kiemTraMem(bieuTuongKhach.locator('xpath=ancestor::*[normalize-space(.) != ""][1]'),
      tenBuoc + ': giữ đúng 1 khách').toHaveText('1');
    const trangThai = testInfo.errors.length === soLoiTruoc ? 'PASS' : 'FAIL';
    cacKiemTra.push({ buoc: tenBuoc, trangThai, diemDaChon, noiDung: await khung.innerText() });
    await page.screenshot({ path: anh(tenBuoc + '-' + trangThai), fullPage: true });
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
    console.log(`TC-BOOK-008: Hà Nội → Hải Phòng; ${ngayDi.hienThi}; chưa đăng nhập.`, thongTinChuyen);

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
      diemDaChon.push({ nhom: tenNhom, ...await docDiem(nhom.getByRole('radio', { checked: true })) });
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
    const giaTrongTheChuyen = thongTinChuyen.match(/(\d[\d.,]*)\s*[đ₫]/)?.[1];
    const donGiaKhuyenMai = Number(giaTrongTheChuyen?.replace(/\D/g, ''));
    expect(Number.isSafeInteger(donGiaKhuyenMai), 'Phải đọc được giá của chuyến đã chọn').toBe(true);
    expect(donGiaKhuyenMai).toBeGreaterThan(0);

    // 2. Chuẩn bị mẫu hợp lệ, chọn giá khuyến mãi theo Test Data TC008.
    await hoTen.fill('khanh lê viết');
    await dienThoai.fill(soDienThoaiHopLe);
    await email.fill(emailHopLe);
    await hoTen.click();
    await page.getByText('Giá khuyến mãi', { exact: true }).click();
    for (const truong of [hoTen, dienThoai, email]) {
      await expect.poll(async () => (await docTrangThaiTruong(truong)).loi,
        'Tiền điều kiện: các trường mẫu phải hợp lệ').toEqual([]);
      await expect.poll(async () => (await docTrangThaiTruong(truong)).ariaInvalid).not.toBe('true');
    }
    await expect(tiepTucLienHe).toBeEnabled();

    // 3. Thiếu SĐT: chỉ kiểm tra mẫu thiếu của TC008, không triển khai các tổ hợp TC009.
    let soLoiTruoc = testInfo.errors.length;
    await dienThoai.fill('');
    await hoTen.click();
    const khiThieuSo = await bamTiepTucVaQuanSat(tiepTucLienHe, urlLienHe);
    if (khiThieuSo.daDoiTrang || !(await dienThoai.isVisible())) {
      cacKiemTra.push({ buoc: 'MISSING-PHONE', trangThai: 'FAIL', url: page.url(), ...khiThieuSo });
      await page.screenshot({ path: anh('MISSING-PHONE-FAIL'), fullPage: true });
    }
    expect(khiThieuSo.daDoiTrang, 'Thiếu SĐT phải chặn chuyển sang thanh toán').toBe(false);
    await expect(dienThoai).toBeVisible();
    await expect(page).toHaveURL(urlLienHe);
    await kiemTraMem.poll(async () => (await docTrangThaiTruong(dienThoai)).loi.length,
      'Thiếu SĐT phải có cảnh báo tại trường SĐT').toBeGreaterThan(0);
    for (const truong of [hoTen, email]) {
      await kiemTraMem.poll(async () => (await docTrangThaiTruong(truong)).loi,
        'Tên/email hợp lệ không được báo lỗi').toEqual([]);
      await kiemTraMem.poll(async () => (await docTrangThaiTruong(truong)).ariaInvalid).not.toBe('true');
    }
    const trangThaiThieu = testInfo.errors.length === soLoiTruoc ? 'PASS' : 'FAIL';
    cacKiemTra.push({ buoc: 'MISSING-PHONE', trangThai: trangThaiThieu,
      ...await docTrangThaiTruong(dienThoai), ...khiThieuSo });
    console.log('TC-BOOK-008 - Thiếu SĐT:', { trangThai: trangThaiThieu, ...khiThieuSo });
    await page.screenshot({ path: anh('MISSING-PHONE-' + trangThaiThieu), fullPage: true });

    // 4. Khôi phục đủ thông tin; ghi lại chuyến và số tiền trước khi chuyển trang.
    await dienThoai.fill(soDienThoaiHopLe);
    await hoTen.click();
    for (const truong of [hoTen, dienThoai, email]) {
      await expect.poll(async () => (await docTrangThaiTruong(truong)).loi,
        'Các trường hợp lệ phải hết lỗi trước khi chuyển bước').toEqual([]);
      await expect.poll(async () => (await docTrangThaiTruong(truong)).ariaInvalid).not.toBe('true');
    }
    await expect(tiepTucLienHe).toBeEnabled();
    await kiemTraThongTinChuyen('TRIP-CONTACT');
    const nhanTamTinh = page.getByText('Tạm tính', { exact: true }).filter({ visible: true });
    await expect(nhanTamTinh).toHaveCount(1);
    await expect.poll(async () => (await docTienTheoNhan(nhanTamTinh)).soTien,
      '1 khách, giá khuyến mãi: Tạm tính phải khớp giá chuyến đã chọn').toBe(donGiaKhuyenMai);
    const tamTinh = await docTienTheoNhan(nhanTamTinh);
    expect(tamTinh.soTien).toBe(donGiaKhuyenMai);
    doiChieuTien = { donGiaKhuyenMai, soKhach: 1, tamTinh };
    console.log('TC-BOOK-008 - Trước chuyển trang:', { diemDaChon, ...doiChieuTien });
    await page.screenshot({ path: anh('VALID-CONTACT'), fullPage: true });

    // 5. Sang trang thanh toán; dùng luồng đã chạy được ở TC005.
    await tiepTucLienHe.click();
    const phuongThucThanhToan = page.getByText('Phương thức thanh toán', { exact: true });
    const chinhSachDuLieu = page.getByText('Chính sách bảo vệ dữ liệu cá nhân', { exact: true });
    await expect(phuongThucThanhToan.or(chinhSachDuLieu).filter({ visible: true }).first())
      .toBeVisible({ timeout: 30000 });
    if (await chinhSachDuLieu.isVisible()) {
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
    console.log('TC-BOOK-008 - Đã tới trang thanh toán:', page.url());

    // 6. Thông tin chuyến và tổng tiền phải được giữ nguyên.
    await kiemTraThongTinChuyen('TRIP-PAYMENT');
    const nhanTongTien = page.getByText('Tổng tiền', { exact: true }).filter({ visible: true });
    await expect(nhanTongTien).toHaveCount(1);
    soLoiTruoc = testInfo.errors.length;
    await kiemTraMem.poll(async () => (await docTienTheoNhan(nhanTongTien)).soTien,
      'Tổng tiền ở trang thanh toán phải bằng Tạm tính trước khi chuyển trang')
      .toBe(tamTinh.soTien);
    const tongTien = await docTienTheoNhan(nhanTongTien);
    const trangThaiTongTien = testInfo.errors.length === soLoiTruoc ? 'PASS' : 'FAIL';
    doiChieuTien = { trangThai: trangThaiTongTien, donGiaKhuyenMai, soKhach: 1, tamTinh, tongTien };
    cacKiemTra.push({ buoc: 'TOTAL-PAYMENT', ...doiChieuTien });
    console.log('TC-BOOK-008 - Đối chiếu tổng tiền:', doiChieuTien);
    await page.screenshot({ path: anh('PAYMENT-' + trangThaiTongTien), fullPage: true });

    // Dừng tại đây: không chọn phương thức, mã giảm giá hay bấm Thanh toán.
    ketQua = testInfo.errors.length === 0 ? 'PASS' : 'FAIL';
    console.log('TC-BOOK-008 - Kết quả automation:', ketQua);
  } catch (error) {
    ketQua = testInfo.expectedStatus === 'skipped' && testInfo.errors.length === 0 ? 'SKIP' : 'FAIL';
    throw error;
  } finally {
    await testInfo.attach('TC-BOOK-008-ket-qua', {
      body: Buffer.from(JSON.stringify({ ketQuaAutomation: ketQua, nhaXe, ngayDi: ngayDi.hienThi,
        tuyen: 'Hà Nội → Hải Phòng', dangNhap: false, diemDaChon,
        cacKiemTra, doiChieuTien }, null, 2), 'utf8'),
      contentType: 'application/json',
    });
    if (!page.isClosed()) await page.screenshot({ path: anh(ketQua), fullPage: true });
  }
});

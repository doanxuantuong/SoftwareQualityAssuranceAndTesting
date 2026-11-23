import { test, expect, Locator, Dialog } from '@playwright/test';
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

test('TC-BOOK-019 - Họ tên rất dài và chuỗi ký tự nguy hiểm', async ({ page }, testInfo) => {
  test.setTimeout(180000);
  page.setDefaultTimeout(15000);

  const ngayDi = ngaySau(3);
  const nhaXe = 'Anh Huy Travel';
  const soDienThoaiHopLe = '0912345678';
  const emailHopLe = 'vexere.tc019@example.com';
  const thoiDiemChay = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Bangkok' });
  const kiemTraMem = expect.configure({ soft: true });
  const cacKiemTra: object[] = [];
  const cacHoiThoai: Array<{ buoc: string; loai: string; noiDung: string }> = [];
  const cacLoiJS: Array<{
    buoc: string; thongBao: string; stack: string; nguon: string | null; tuUngDung: boolean;
  }> = [];
  const cacLanCrash: string[] = [];
  let buocDangThu = 'SETUP';
  let ketQuaKyThuat = 'FAIL';
  let ketQuaTheoExcel = 'NOT RUN';
  const ghiChuXacThuc = 'Chưa có quy tắc xác thực đã xác minh cho tên dài 150 ký tự, '
    + 'chuỗi script và chuỗi dạng SQL. Ghi nhận chấp nhận/từ chối, chưa kết luận tính hợp lệ '
    + 'của các chuỗi; Test Cases!I15/M15 và Test Execution!EXE-012: Pending Evaluation.';
  const anh = (ten: string) => path.join(__dirname,
    'screenshots/TC-BOOK-019-' + testInfo.project.name + '-' + ten + '.png');

  const theoDoiHoiThoai = async (dialog: Dialog) => {
    cacHoiThoai.push({ buoc: buocDangThu, loai: dialog.type(), noiDung: dialog.message() });
    // Đóng bằng thao tác trình duyệt để test tiếp tục; vẫn lưu bằng chứng nếu alert(1) chạy.
    await dialog.dismiss();
  };
  const theoDoiLoiJS = (error: Error) => {
    const stack = error.stack || '';
    const nguon = stack.match(/https?:\/\/[^\s)]+/)?.[0] ?? null;
    let tuUngDung = true;
    if (nguon) {
      const mien = new URL(nguon).hostname;
      tuUngDung = mien === 'vexere.com' || mien.endsWith('.vexere.com');
    }
    cacLoiJS.push({ buoc: buocDangThu, thongBao: error.message, stack, nguon, tuUngDung });
  };
  const theoDoiCrash = () => { cacLanCrash.push(buocDangThu); };

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
    console.log(`TC-BOOK-019: Hà Nội → Hải Phòng; ${ngayDi.hienThi}; chưa đăng nhập.`, thongTinChuyen);

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


    // 2. Dữ liệu liên hệ khác hợp lệ để quan sát riêng trường Họ tên.
    await hoTen.fill('khanh lê viết');
    await dienThoai.fill(soDienThoaiHopLe);
    await email.fill(emailHopLe);
    await dienThoai.click();
    await expect(dienThoai).toBeFocused();
    await expect(hoTen).toBeVisible();
    await expect(page).toHaveURL(urlLienHe);
    const loiHeThong = () => page.getByText(
      /đã có lỗi xảy ra|đã xảy ra lỗi|lỗi không mong muốn|something went wrong|unexpected error/i,
    ).filter({ visible: true });
    await expect(loiHeThong(), 'Trang liên hệ phải bình thường trước khi thử dữ liệu').toHaveCount(0);
    await page.screenshot({ path: anh('BASELINE'), fullPage: true });

    // Chỉ theo dõi lỗi trong thời gian thử nhập; không lấy lỗi từ luồng tìm/chọn chuyến.
    page.on('dialog', theoDoiHoiThoai);
    page.on('pageerror', theoDoiLoiJS);
    page.on('crash', theoDoiCrash);
    console.log('TC-BOOK-019 - Điều kiện chạy:', {
      nhaXe, tuyen: 'Hà Nội → Hải Phòng', ngayDi: ngayDi.hienThi,
      dangNhap: false, thoiDiemChay, phamVi: 'Nhập và rời ô tại trang liên hệ, không chuyển bước.',
    });

    const cacDuLieu = [
      { ma: 'LONG-150', duLieu: 'a'.repeat(150) },
      { ma: 'SCRIPT', duLieu: '<script>alert(1)</script>' },
      { ma: 'SQL-LIKE', duLieu: "' OR 1=1 --" },
    ];
    for (const duLieu of cacDuLieu) {
      buocDangThu = duLieu.ma;
      const soLoiTruoc = testInfo.errors.length;
      // fill thay nội dung của ô như dữ liệu người dùng, không đưa payload vào evaluate/innerHTML.
      await hoTen.fill(duLieu.duLieu);
      await dienThoai.click();
      await expect(dienThoai, 'Phải thực sự rời ô Họ tên bằng thao tác UI').toBeFocused();
      // Cửa sổ quan sát có chủ đích sau blur để bắt alert/lỗi JS phát sinh trễ.
      // Không đợi một thông báo validation cụ thể vì Excel chưa xác minh quy tắc đó.
      const thoiGianQuanSatMs = 1000;
      await page.waitForTimeout(thoiGianQuanSatMs);

      const hoiThoai = cacHoiThoai.filter(d => d.buoc === duLieu.ma);
      const loiJS = cacLoiJS.filter(d => d.buoc === duLieu.ma);
      const loiUngDung = loiJS.filter(d => d.tuUngDung);
      const scriptDaChay = hoiThoai.filter(d => d.loai === 'alert' && d.noiDung.trim() === '1');
      await kiemTraMem(scriptDaChay, duLieu.ma + ': không được thực thi alert(1)').toEqual([]);
      await kiemTraMem(cacLanCrash.filter(buoc => buoc === duLieu.ma),
        duLieu.ma + ': trang không được crash').toEqual([]);
      await kiemTraMem(loiUngDung,
        duLieu.ma + ': không phát sinh lỗi JavaScript chưa xử lý từ ứng dụng').toEqual([]);
      await kiemTraMem(page, duLieu.ma + ': nhập/rời ô không được điều hướng bất thường')
        .toHaveURL(urlLienHe);
      await kiemTraMem(hoTen, duLieu.ma + ': form Họ tên phải còn hiển thị').toBeVisible();
      await kiemTraMem(loiHeThong(), duLieu.ma + ': không xuất hiện thông báo lỗi hệ thống')
        .toHaveCount(0);
      await kiemTraMem(dienThoai, 'Nhập Họ tên không được làm mất SĐT').toHaveValue(soDienThoaiHopLe);
      await kiemTraMem(email, 'Nhập Họ tên không được làm mất email').toHaveValue(emailHopLe);

      const truong = await docTrangThaiTruong(hoTen);
      const trangThaiKyThuat = testInfo.errors.length === soLoiTruoc ? 'PASS' : 'FAIL';
      const quanSat = {
        buoc: duLieu.ma, duLieu: duLieu.duLieu, doDaiDauVao: duLieu.duLieu.length,
        trangThaiKyThuat, trangThaiXacThuc: 'PENDING EVALUATION',
        ...truong, doDaiThucTe: truong.giaTri.length,
        giuNguyenChuoi: truong.giaTri === duLieu.duLieu,
        maxlength: await hoTen.getAttribute('maxlength'),
        nutTiepTucBiKhoa: await tiepTucLienHe.isDisabled(),
        hoiThoai, scriptDaChay: scriptDaChay.length > 0,
        loiJS, loiHeThong: await loiHeThong().allTextContents(),
        url: page.url(), thoiGianQuanSatMs,
      };
      cacKiemTra.push(quanSat);
      console.log('TC-BOOK-019 - Quan sát:', quanSat);
      await page.screenshot({ path: anh(duLieu.ma + '-' + trangThaiKyThuat), fullPage: true });
    }

    ketQuaKyThuat = testInfo.errors.length === 0 ? 'PASS' : 'FAIL';
    ketQuaTheoExcel = ketQuaKyThuat === 'PASS' ? 'PENDING EVALUATION' : 'FAIL';
    if (ketQuaKyThuat === 'PASS') {
      testInfo.annotations.push({ type: 'Pending Evaluation', description: ghiChuXacThuc });
    }
    // Không bấm Tiếp tục, không gửi payload sang trang thanh toán.
  } catch (error) {
    ketQuaKyThuat = testInfo.expectedStatus === 'skipped' && testInfo.errors.length === 0 ? 'SKIP' : 'FAIL';
    ketQuaTheoExcel = ketQuaKyThuat === 'SKIP' ? 'NOT RUN' : 'FAIL';
    throw error;
  } finally {
    page.off('dialog', theoDoiHoiThoai);
    page.off('pageerror', theoDoiLoiJS);
    page.off('crash', theoDoiCrash);
    console.log('TC-BOOK-019 - Kết quả các kiểm tra đã có kỳ vọng:', ketQuaKyThuat);
    console.log('TC-BOOK-019 - Kết luận theo Excel:', ketQuaTheoExcel);
    console.log('TC-BOOK-019 - Ghi chú:', ghiChuXacThuc);
    await testInfo.attach('TC-BOOK-019-ket-qua', {
      body: Buffer.from(JSON.stringify({ ketQuaKyThuat, ketQuaTheoExcel, ghiChuXacThuc,
        nhaXe, ngayDi: ngayDi.hienThi, tuyen: 'Hà Nội → Hải Phòng', dangNhap: false,
        thoiDiemChay, cacKiemTra, cacHoiThoai, cacLoiJS, cacLanCrash,
        phamVi: 'Quan sát tại thời điểm nhập/blur; chưa kiểm tra lưu dữ liệu hoặc xử lý ở máy chủ.',
      }, null, 2)),
      contentType: 'application/json',
    });
    if (!page.isClosed() && cacLanCrash.length === 0) {
      await page.screenshot({ path: anh(ketQuaTheoExcel.replace(/\s+/g, '-')), fullPage: true });
    }
  }
});

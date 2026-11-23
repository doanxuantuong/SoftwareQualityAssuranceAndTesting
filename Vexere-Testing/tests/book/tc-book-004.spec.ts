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

test('TC-BOOK-004 - Nhập họ tên liên hệ', async ({ page }, testInfo) => {
  test.setTimeout(180000);
  page.setDefaultTimeout(15000);

  const ngayDi = ngaySau(3);
  const nhaXe = 'Anh Huy Travel';
  const soDienThoai = '0912345678';
  const emailHopLe = 'vexere.tc004@example.com';
  let ketQua = 'FAIL';
  const cacQuanSat: object[] = [];
  const anh = (ten: string) => path.join(__dirname,
    `screenshots/TC-BOOK-004-${testInfo.project.name}-${ten}.png`);

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
    console.log(`TC-BOOK-004: Hà Nội → Hải Phòng; ${ngayDi.hienThi}; chưa đăng nhập.`, thongTinChuyen);

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
    await dienThoai.fill(soDienThoai);
    await email.fill(emailHopLe);

    // 2. Quy tắc đã xác nhận: họ tên rỗng phải có thông báo bắt buộc sau blur.
    await hoTen.fill('');
    await hoTen.focus();
    await dienThoai.click();
    await expect.poll(async () => (await docTrangThaiTruong(hoTen)).loi.join(' '),
      'Họ tên rỗng phải hiển thị thông báo bắt buộc nhập sau khi rời ô')
      .toMatch(/vui lòng|bắt buộc|không để trống|chưa nhập|cần nhập|required|please enter/i);
    cacQuanSat.push({ buoc: 'Rỗng sau blur', trangThai: 'PASS', ...await docTrangThaiTruong(hoTen) });
    await page.screenshot({ path: anh('EMPTY-BLUR'), fullPage: true });

    // 3. R2: chỉ họ tên sai, điện thoại/email đúng; bấm Tiếp tục phải ở lại.
    await expect(tiepTucLienHe).toHaveCount(1);
    const dieuHuongKhiRong = await bamTiepTucVaQuanSat(tiepTucLienHe, urlLienHe);
    expect(dieuHuongKhiRong.daDoiTrang, 'R2: họ tên rỗng phải chặn chuyển bước').toBe(false);
    await expect(hoTen, 'R2: họ tên rỗng không được chuyển sang bước thanh toán').toBeVisible();
    await expect(page).toHaveURL(urlLienHe);
    await expect.poll(async () => (await docTrangThaiTruong(hoTen)).loi.length,
      'R2: cảnh báo phải thuộc trường Họ tên').toBeGreaterThan(0);
    for (const truong of [dienThoai, email]) {
      await expect.poll(async () => (await docTrangThaiTruong(truong)).loi,
        'R2: dữ liệu điện thoại/email hợp lệ không được báo lỗi').toEqual([]);
      await expect.poll(async () => (await docTrangThaiTruong(truong)).ariaInvalid).not.toBe('true');
    }
    cacQuanSat.push({ buoc: 'R2 - chỉ họ tên rỗng', trangThai: 'PASS', url: page.url(), ...dieuHuongKhiRong,
      ...await docTrangThaiTruong(hoTen) });
    await page.screenshot({ path: anh('EMPTY-SUBMIT'), fullPage: true });

    // 4. Tên tiếng Việt: giữ nguyên dấu và không còn lỗi thuộc trường Họ tên.
    await hoTen.fill('khanh lê viết');
    await email.click();
    await expect(hoTen).toHaveValue('khanh lê viết');
    await expect.poll(async () => (await docTrangThaiTruong(hoTen)).loi,
      'Tên có dấu phải được chấp nhận, thông báo lỗi họ tên phải biến mất').toEqual([]);
    await expect.poll(async () => (await docTrangThaiTruong(hoTen)).ariaInvalid).not.toBe('true');
    cacQuanSat.push({ buoc: 'Tên có dấu', trangThai: 'PASS', ...await docTrangThaiTruong(hoTen) });
    await page.screenshot({ path: anh('VALID-NAME'), fullPage: true });

    // 5. Excel I6/M6 và EP-HT-04/05 chưa xác nhận các quy tắc dưới đây.
    // Ghi hành vi thực tế; không tự coi việc được chấp nhận/từ chối là PASS/FAIL.
    testInfo.annotations.push({ type: 'BLOCKED', description:
      'TC004: cần xác nhận quy tắc @@@, ba dấu cách và tên toàn số theo Excel I6/M6.' });
    for (const duLieu of [
      { ten: 'SPECIAL-CHARS', giaTri: '@@@' },
      { ten: 'NUMERIC-NAME', giaTri: '1231313' },
    ]) {
      await hoTen.fill(duLieu.giaTri);
      await email.click();
      const quanSat = { buoc: duLieu.ten, duLieu: duLieu.giaTri,
        trangThai: 'CẦN XÁC NHẬN QUY TẮC', ...await docTrangThaiTruong(hoTen) };
      cacQuanSat.push(quanSat);
      console.log('Quan sát họ tên:', quanSat);
      await page.screenshot({ path: anh(duLieu.ten), fullPage: true });
    }

    // 6. Ba dấu cách: ghi trạng thái sau blur và sau khi bấm Tiếp tục.
    await hoTen.fill('   ');
    await email.click();
    const truocTiepTuc = await docTrangThaiTruong(hoTen);
    await page.screenshot({ path: anh('SPACES-BLUR'), fullPage: true });
    const dieuHuongKhiDauCach = await bamTiepTucVaQuanSat(tiepTucLienHe, urlLienHe);
    const vanCoHoTen = await hoTen.isVisible();
    const quanSatDauCach = {
      buoc: 'Ba dấu cách và Tiếp tục', duLieu: '   ', trangThai: 'CẦN XÁC NHẬN QUY TẮC',
      truocTiepTuc, ...dieuHuongKhiDauCach, url: page.url(),
      sauTiepTuc: vanCoHoTen ? await docTrangThaiTruong(hoTen) : null,
    };
    cacQuanSat.push(quanSatDauCach);
    console.log('Quan sát ba dấu cách:', quanSatDauCach);
    await page.screenshot({ path: anh('SPACES-SUBMIT'), fullPage: true });

    // Không bấm Tiếp tục với tên hợp lệ hoặc thao tác thanh toán.
    ketQua = 'BLOCKED';
    console.log('TC-BOOK-004: kiểm tra tên rỗng, R2 và tên có dấu đã đạt. '
      + 'Kết luận nghiệp vụ: BLOCKED, chờ xác nhận quy tắc cho @@@, ba dấu cách và tên toàn số. '
      + 'Kết quả xanh của Playwright không đồng nghĩa toàn bộ TC004 đã PASS nghiệp vụ.');
  } catch (error) {
    ketQua = testInfo.expectedStatus === 'skipped' && testInfo.errors.length === 0 ? 'SKIP' : 'FAIL';
    throw error;
  } finally {
    await testInfo.attach('TC-BOOK-004-ket-qua', {
      body: Buffer.from(JSON.stringify({ ketQua, nhaXe, ngayDi: ngayDi.hienThi,
        tuyen: 'Hà Nội → Hải Phòng', dangNhap: false, cacQuanSat }, null, 2), 'utf8'),
      contentType: 'application/json',
    });
    if (!page.isClosed()) await page.screenshot({ path: anh(ketQua), fullPage: true });
  }
});

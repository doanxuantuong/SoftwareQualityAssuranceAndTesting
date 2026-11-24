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

const cacNhanh = [
  { ma: 'EMAIL', truong: 'Email', giaTriSai: '1231313', mauLoi: /e-?mail không hợp lệ/i },
  { ma: 'PHONE', truong: 'SĐT', giaTriSai: '0964429619123', mauLoi: /số điện thoại không hợp lệ/i },
] as const;

for (const nhanh of cacNhanh) {
  test('TC-BOOK-022 - Lỗi ' + nhanh.truong + ' biến mất khi sửa đúng', async ({ page }, testInfo) => {
    test.setTimeout(180000);
    page.setDefaultTimeout(15000);

    // Mỗi lượt dùng ngày đi riêng để tránh giữ cùng chỗ khi chạy song song.
    const ngayDi = ngaySau(nhanh.ma === 'EMAIL' ? 3 : 4);
    const nhaXe = 'Anh Huy Travel';
    const soDienThoaiHopLe = '0912345678';
    const emailHopLe = 'vexere.tc022@example.com';
    const anh = (buoc: string) => path.join(__dirname,
      'screenshots/TC-BOOK-022-' + testInfo.project.name + '-' + nhanh.ma + '-' + buoc + '.png');
    let ketQua = 'FAIL';

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
      console.log('TC-BOOK-022 - Điều kiện chạy:', {
        nhanh: nhanh.ma, nhaXe, tuyen: 'Hà Nội → Hải Phòng', ngayDi: ngayDi.hienThi,
        dangNhap: false, thongTinChuyen,
      });

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
      // Đây là nhãn của textbox; placeholder thật chỉ là một dấu cách.
      const dienThoai = page.getByRole('textbox', { name: 'Số điện thoại', exact: true });
      const email = page.getByRole('textbox', { name: 'Email nhận thông tin', exact: true });
      const tiepTucLienHe = page.getByRole('button', { name: /^Tiếp tục(?:\s|$)/i })
        .filter({ visible: true });
      await expect(hoTen).toBeVisible();
      await expect(dienThoai).toBeVisible();
      await expect(email).toBeVisible();
      await expect(tiepTucLienHe).toHaveCount(1);


      const truongCanThu = nhanh.ma === 'EMAIL' ? email : dienThoai;
      const truongConLai = nhanh.ma === 'EMAIL' ? dienThoai : email;
      const giaTriDung = nhanh.ma === 'EMAIL' ? emailHopLe : soDienThoaiHopLe;
      const giaTriConLai = nhanh.ma === 'EMAIL' ? soDienThoaiHopLe : emailHopLe;
      const nhanHoTen = page.locator('label[for="userName"]').filter({ visible: true });
      const roiO = async () => {
        await nhanHoTen.click();
        await expect(hoTen).toBeFocused();
      };
      const kiemTraHetLoi = (truong: Locator, ten: string) =>
        expect.poll(async () => {
          const { loi, ariaInvalid } = await docTrangThaiTruong(truong);
          return { loi, biDanhDauSai: ariaInvalid === 'true' };
        }, { message: ten + ' phải không còn lỗi xác thực' })
          .toEqual({ loi: [], biDanhDauSai: false });

      // Chuẩn bị các trường hợp lệ trước khi tạo lỗi ở đúng một ô.
      await hoTen.fill('khanh lê viết');
      await dienThoai.fill(soDienThoaiHopLe);
      await email.fill(emailHopLe);
      await roiO();
      await kiemTraHetLoi(truongCanThu, nhanh.truong);
      await kiemTraHetLoi(truongConLai, 'Trường còn lại');
      await expect(tiepTucLienHe).toBeEnabled();

      await truongCanThu.fill(nhanh.giaTriSai);
      await roiO();
      await expect(truongCanThu).toHaveValue(nhanh.giaTriSai);
      await expect.poll(async () => (await docTrangThaiTruong(truongCanThu)).loi.join(' '), {
        message: 'Phải hiển thị lỗi tại ô ' + nhanh.truong + ' sai',
      }).toMatch(nhanh.mauLoi);
      await expect(truongConLai).toHaveValue(giaTriConLai);
      await kiemTraHetLoi(truongConLai, 'Trường còn lại');
      console.log('TC-BOOK-022 - ' + nhanh.ma + ' trước khi sửa:', await docTrangThaiTruong(truongCanThu));
      await page.screenshot({ path: anh('INVALID'), fullPage: true });

      // Chỉ sửa trường đang sai và xác nhận lỗi tự mất trước khi bấm Tiếp tục.
      await truongCanThu.fill(giaTriDung);
      await roiO();
      await expect(truongCanThu).toHaveValue(giaTriDung);
      await expect(truongConLai).toHaveValue(giaTriConLai);
      await kiemTraHetLoi(truongCanThu, nhanh.truong);
      await kiemTraHetLoi(truongConLai, 'Trường còn lại');
      await expect(tiepTucLienHe).toBeEnabled();
      console.log('TC-BOOK-022 - ' + nhanh.ma + ' sau khi sửa:', await docTrangThaiTruong(truongCanThu));
      await page.screenshot({ path: anh('CORRECTED'), fullPage: true });

      const phuongThucThanhToan = page.getByText('Phương thức thanh toán', { exact: true });
      const chinhSachDuLieu = page.getByText('Chính sách bảo vệ dữ liệu cá nhân', { exact: true })
        .filter({ visible: true });
      const popupLoi = page.getByRole('dialog', { name: /^Ôi không!?$/i }).filter({ visible: true });
      const phanHoiChuyenBuoc = phuongThucThanhToan.or(popupLoi).filter({ visible: true });
      const kiemTraPopupLoi = async () => {
        if (!(await popupLoi.isVisible())) return;
        const noiDung = (await popupLoi.innerText()).replace(/\s+/g, ' ').trim();
        if (/chỗ bạn chọn đã có người khác.*mua rồi.*chọn chỗ khác/i.test(noiDung)) {
          console.log('TC-BOOK-022 - ' + nhanh.ma + ' thiếu chỗ khả dụng:', noiDung);
          test.skip(true, 'Không thể kiểm tra chuyển bước: Vexere báo chỗ đã được người khác mua.');
        }
        throw new Error('Vexere báo lỗi khi chuyển sang thanh toán: ' + noiDung);
      };
      const mauLienHe = /\/bookingconfirmation(?:[/?#]|$)/;
      const mauThanhToan = /\/payment-methods?\/[^/?#]+(?:[/?#]|$)/;
      await tiepTucLienHe.click();
      await expect(phanHoiChuyenBuoc.or(chinhSachDuLieu).first())
        .toBeVisible({ timeout: 30000 });
      await kiemTraPopupLoi();
      if (await chinhSachDuLieu.isVisible()) {
        const popup = chinhSachDuLieu
          .locator('xpath=ancestor::*[.//button[normalize-space(.)="Xác nhận"]][1]');
        const dongY = popup.getByRole('checkbox').filter({ visible: true });
        if (await dongY.count() > 0) {
          await expect(dongY).toHaveCount(1);
          await dongY.check();
        }
        await popup.getByRole('button', { name: 'Xác nhận', exact: true }).click();
        await expect(chinhSachDuLieu).toBeHidden();
        // Một số phiên vẫn ở trang liên hệ sau khi đã xác nhận chính sách.
        const coPhanHoi = await phanHoiChuyenBuoc.first().waitFor({ state: 'visible', timeout: 3000 })
          .then(() => true, error => {
            if (error instanceof Error && error.name === 'TimeoutError') return false;
            throw error;
          });
        await kiemTraPopupLoi();
        if (!coPhanHoi && mauLienHe.test(page.url()) && await tiepTucLienHe.isVisible()) {
          await tiepTucLienHe.click();
        }
      }

      await expect(phanHoiChuyenBuoc.first()).toBeVisible({ timeout: 30000 });
      await kiemTraPopupLoi();
      await expect(phuongThucThanhToan).toBeVisible({ timeout: 30000 });
      await expect(page).toHaveURL(mauThanhToan, { timeout: 30000 });
      // Dừng khi đã tới trang Phương thức thanh toán.
      ketQua = 'PASS';
    } catch (error) {
      if (testInfo.expectedStatus === 'skipped') ketQua = 'SKIP';
      throw error;
    } finally {
      console.log('TC-BOOK-022 - Kết quả nhánh ' + nhanh.ma + ':', ketQua);
      if (!page.isClosed()) await page.screenshot({ path: anh(ketQua), fullPage: true });
    }
  });
}

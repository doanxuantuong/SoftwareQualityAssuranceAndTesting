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

test('TC-BOOK-002 - Chọn điểm đón và điểm trả từ danh sách', async ({ page }, testInfo) => {
  test.setTimeout(180000);
  page.setDefaultTimeout(15000);

  const ngayDi = ngaySau(3);
  const nhaXe = 'Anh Huy Travel';
  let ketQua = 'FAIL';

  // Chỉ lấy khung của chuyến đang mở, tránh lấy radio trong bộ lọc tìm chuyến.
  const khungDatVe = () => page.getByRole('button', { name: 'Đóng', exact: true })
    .filter({ visible: true }).first()
    .locator('xpath=ancestor::div[.//button[contains(@class,"footer-nextstep")]][1]');
  const nhomDiem = (ten: string) => khungDatVe().getByText(ten, { exact: true })
    .locator('xpath=ancestor::div[.//input[@type="radio"] or .//*[@role="radio"]][1]');

  // Hàng địa điểm chứa radio, giờ, tên, địa chỉ và liên kết Bản đồ.
  // Khung gần radio nhất chỉ chứa giờ nên chưa đủ để đọc tên địa điểm.
  const khungLuaChon = (radio: Locator) => radio.locator(
    'xpath=ancestor::*[count(.//input[@type="radio"] | .//*[@role="radio"])=1 and .//*[normalize-space(.)="Bản đồ"]][1]',
  );

  async function docDiem(radio: Locator) {
    const text = await khungLuaChon(radio).innerText();
    const gio = text.match(/\b\d{1,2}:\d{2}\b/)?.[0];
    expect(gio, 'Lựa chọn phải có giờ đón/trả').toBeTruthy();
    const cacDong = text.split('\n').map(d => d.trim()).filter(Boolean);
    const viTriGio = cacDong.findIndex(d => d.includes(gio!));
    const cacDongTen = [cacDong[viTriGio].replace(gio!, '').trim(), ...cacDong.slice(viTriGio + 1)];
    const ten = cacDongTen.find(d => /[0-9A-Za-zÀ-ỹ]/.test(d)
      && !/Lưu ý quan trọng|Bản đồ/i.test(d)
      && !/^(place|emoji)$/i.test(d));
    expect(ten, 'Phải đọc được tên điểm đón/trả').toBeTruthy();
    return { ten: ten!, gio: gio!, text };
  }

  async function kiemTraMotLuaChon(nhom: Locator, radio: Locator) {
    await expect(radio).toBeChecked();
    await expect(nhom.getByRole('radio', { checked: true }), 'Mỗi nhóm chỉ được chọn một điểm')
      .toHaveCount(1);
  }

  // Quy định nhà xe có thể được mở trước khi chuyển bước.
  async function bamVaDongQuyDinh(nut: Locator, buocDich: Locator) {
    await nut.click();
    const dongY = page.getByText('Tôi đã đọc và đồng ý', { exact: true });
    // Chờ trạng thái thật: đã sang bước mới hoặc nhà xe đang yêu cầu xác nhận.
    await expect(buocDich.or(dongY).filter({ visible: true }).first())
      .toBeVisible({ timeout: 30000 });
    if (await dongY.isVisible()) {
      await dongY.click();
      await expect(dongY).toBeHidden();
      // Locator nút được ghim theo data-current để không bấm lố bước tiếp theo.
      if (!(await buocDich.isVisible()) && await nut.isVisible()) await nut.click();
    }
    await expect(buocDich).toBeVisible({ timeout: 30000 });
  }

  const anh = (ten: string) => path.join(__dirname, `screenshots/TC-BOOK-002-${testInfo.project.name}-${ten}.png`);

  try {
    // 1. Chuẩn bị chuyến một chiều Hà Nội → Hải Phòng, hôm nay + 3 ngày.
    // TC002 kiểm tra điểm đón/trả; không kiểm tra giới hạn khách của TC001.
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

    // 2. Mở chuyến Anh Huy Travel còn chỗ, ghi lại thông tin chuyến đang dùng.
    const cacNut = page.getByRole('button', { name: 'Chọn chỗ', exact: true });
    await cacNut.first().waitFor({ state: 'visible', timeout: 30000 });
    let thongTinChuyen = '';
    for (let i = 0; i < await cacNut.count(); i++) {
      const nut = cacNut.nth(i);
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
    console.log(`TC-BOOK-002: Hà Nội → Hải Phòng; ${ngayDi.hienThi}; chưa đăng nhập.`, thongTinChuyen);

    // Chuẩn bị 1 khách để chuyển bước, không đánh giá mặc định 0/1 ở case này.
    const boDem = khungDatVe().locator('.online-note-selection div[class*="QuantityInput"]').first();
    await expect(boDem).toBeVisible({ timeout: 20000 });
    const soKhachBanDau = Number((await boDem.innerText()).trim());
    expect(Number.isInteger(soKhachBanDau)).toBe(true);
    expect(soKhachBanDau).toBeGreaterThanOrEqual(0);
    expect(soKhachBanDau).toBeLessThanOrEqual(8);
    for (let i = soKhachBanDau; i < 1; i++) await boDem.locator('svg[class*="PlusIcon"]').click();
    for (let i = soKhachBanDau; i > 1; i--) await boDem.locator('svg[class*="SubIcon"]').click();
    await expect(boDem).toHaveText('1');

    // Nhãn "Điểm đón trả" là thanh chỉ bước, không phải nút chuyển bước.
    // Bấm Tiếp tục ở bước 0, rồi chờ footer bước 1 trước khi đọc các lựa chọn.
    const tiepTucChonCho = khungDatVe().locator('button.footer-nextstep[data-current="0"]')
      .filter({ visible: true }).first();
    const tiepTucDiemDonTra = khungDatVe().locator('button.footer-nextstep[data-current="1"]')
      .filter({ visible: true }).first();
    await bamVaDongQuyDinh(tiepTucChonCho, tiepTucDiemDonTra);
    const diemDon = nhomDiem('Điểm đón');
    const diemTra = nhomDiem('Điểm trả');
    await expect(diemDon.getByRole('radio').first()).toBeVisible({ timeout: 20000 });
    await expect(diemTra.getByRole('radio').first()).toBeVisible();

    // 3. Quan sát lựa chọn mặc định. Chuyến phải có điểm đón khác có ghi chú.
    const cacDiemDon = diemDon.getByRole('radio');
    const cacDiemTra = diemTra.getByRole('radio');
    const soDiemDon = await cacDiemDon.count();
    const soDiemTra = await cacDiemTra.count();
    test.skip(soDiemDon < 2, 'Chuyến hiện tại không có hai điểm đón để kiểm tra đổi lựa chọn.');
    expect(soDiemTra, 'Chuyến phải có điểm trả trong danh sách').toBeGreaterThan(0);

    const diemDonMacDinh = diemDon.getByRole('radio', { checked: true });
    await expect(diemDonMacDinh).toHaveCount(1);
    let viTriMacDinh = -1;
    for (let i = 0; i < soDiemDon; i++) {
      if (await cacDiemDon.nth(i).isChecked()) viTriMacDinh = i;
    }
    expect(viTriMacDinh).toBeGreaterThanOrEqual(0);
    console.log('Điểm đón mặc định:', await docDiem(cacDiemDon.nth(viTriMacDinh)));

    let radioTra = cacDiemTra.first();
    if (soDiemTra > 1) {
      // Nhiều điểm trả là dữ liệu hợp lệ: chọn một điểm khác thay vì bỏ qua TC002.
      expect(await diemTra.getByRole('radio', { checked: true }).count(), 'Không được chọn đồng thời nhiều điểm trả')
        .toBeLessThanOrEqual(1);
      let viTriTraMacDinh = -1;
      for (let i = 0; i < soDiemTra; i++) {
        if (await cacDiemTra.nth(i).isChecked()) viTriTraMacDinh = i;
      }
      radioTra = cacDiemTra.nth(viTriTraMacDinh === 0 ? 1 : 0);
      await radioTra.check();
      if (viTriTraMacDinh >= 0) await expect(cacDiemTra.nth(viTriTraMacDinh)).not.toBeChecked();
    }
    // Nhánh một điểm không bấm chọn: phải được website chọn sẵn theo Excel.
    await kiemTraMotLuaChon(diemTra, radioTra);
    const traDaChon = await docDiem(radioTra);
    if (soDiemTra === 1) {
      const cacDauChuyen = [...thongTinChuyen.matchAll(/(\d{1,2}:\d{2})\s*\n\s*•\s*([^\n]+)/g)];
      expect(cacDauChuyen.length, 'Phải đọc được điểm đi và điểm đến của chuyến').toBeGreaterThanOrEqual(2);
      await expect(khungLuaChon(radioTra), 'Điểm trả duy nhất phải đúng với chuyến đã mở')
        .toContainText(cacDauChuyen[1][2].trim());
      expect(traDaChon.gio, 'Giờ trả phải đúng với chuyến đang kiểm tra').toBe(cacDauChuyen[1][1]);
    }

    let viTriMoi = -1;
    for (let i = 0; i < soDiemDon; i++) {
      if (i === viTriMacDinh) continue;
      const luaChon = khungLuaChon(cacDiemDon.nth(i));
      if (await luaChon.getByText('Lưu ý quan trọng', { exact: true }).count()) {
        viTriMoi = i;
        if ((await luaChon.innerText()).includes('982 Đường Láng')) break;
      }
    }
    test.skip(viTriMoi < 0, 'Không có điểm đón khác kèm Lưu ý quan trọng để kiểm tra đủ TC002.');

    // 4. Đổi điểm đón: điểm mới checked, điểm cũ unchecked, tổng số checked là 1.
    const radioDon = cacDiemDon.nth(viTriMoi);
    await radioDon.check();
    await kiemTraMotLuaChon(diemDon, radioDon);
    await expect(cacDiemDon.nth(viTriMacDinh)).not.toBeChecked();
    const donDaChon = await docDiem(radioDon);
    console.log('Điểm đón đã chọn:', donDaChon, 'Điểm trả đã chọn:', traDaChon);

    // 5. Mở, đọc, đóng rồi mở lại ghi chú; không được làm đổi lựa chọn đón/trả.
    const lienKetGhiChu = khungLuaChon(radioDon).getByText('Lưu ý quan trọng', { exact: true });
    const cacPopup = () => page.locator('.ant-modal-wrap:visible, .ant-popover:visible, .ant-tooltip:visible');
    let noiDungLanDau = '';

    for (let lan = 1; lan <= 2; lan++) {
      await expect(cacPopup(), 'Không để popup khác che ghi chú trước khi mở').toHaveCount(0);
      await lienKetGhiChu.click();
      await expect.poll(() => cacPopup().count(), 'Bấm ghi chú phải mở nội dung').toBeGreaterThan(0);
      const popupCoTieuDe = cacPopup().filter({ hasText: /Lưu ý quan trọng/i });
      // Ưu tiên đúng tiêu đề; popover không có tiêu đề phải là popup duy nhất vừa mở.
      const coTieuDe = await popupCoTieuDe.count() > 0;
      if (!coTieuDe) await expect(cacPopup()).toHaveCount(1);
      const popup = coTieuDe ? popupCoTieuDe.first() : cacPopup();
      await expect(popup, 'Mở ghi chú phải hiển thị nội dung').toBeVisible();
      const thanGhiChu = popup.locator('.ant-modal-body, .ant-popover-inner-content, .ant-tooltip-inner').first();
      await expect(thanGhiChu).toBeVisible();
      const noiDung = (await thanGhiChu.innerText()).replace(/\s+/g, ' ').trim();
      const noiDungChinh = noiDung.replace(/Lưu ý quan trọng|Đã hiểu|Đóng|close/gi, '').trim();
      expect(noiDungChinh.length, 'Ghi chú phải có nội dung, không chỉ có tiêu đề').toBeGreaterThan(0);
      if (lan === 1) {
        noiDungLanDau = noiDung;
        console.log('Nội dung Lưu ý quan trọng:', noiDung);
        await page.screenshot({ path: anh('NOTE'), fullPage: true });
      } else {
        expect(noiDung, 'Nội dung ghi chú được giữ khi mở lại').toBe(noiDungLanDau);
      }
      await kiemTraMotLuaChon(diemDon, radioDon);
      await kiemTraMotLuaChon(diemTra, radioTra);

      const nutDong = popup.locator('.ant-modal-close').first();
      const nutXacNhan = popup.getByRole('button', { name: /^(Đóng|Đã hiểu|Close|close)$/ }).first();
      if (await nutDong.isVisible()) await nutDong.click();
      else if (await nutXacNhan.isVisible()) await nutXacNhan.click();
      else {
        // Popover/tooltip đóng khi bấm ra tiêu đề, không bấm vào radio khác.
        await diemDon.getByText('Điểm đón', { exact: true }).click();
      }
      await expect(popup).toBeHidden();
      await expect(cacPopup()).toHaveCount(0);
      await kiemTraMotLuaChon(diemDon, radioDon);
      await kiemTraMotLuaChon(diemTra, radioTra);
    }

    // 6. Lưu điểm đã chọn, chuyển tiếp và đối chiếu trên trang thông tin liên hệ.
    await page.screenshot({ path: anh('POINTS'), fullPage: true });
    await bamVaDongQuyDinh(tiepTucDiemDonTra, page.locator('#userName'));
    await expect(page).toHaveURL(/\/bookingconfirmation(?:[/?#]|$)/, { timeout: 30000 });
    await expect(page.locator('#userName')).toBeVisible();

    const thongTinChuyenDi = page.getByText('Thông tin chuyến đi', { exact: true })
      .locator('xpath=ancestor::div[.//*[normalize-space(.)="Thay đổi"]][1]');
    await expect(thongTinChuyenDi).toBeVisible();
    await expect(thongTinChuyenDi).toContainText(nhaXe);
    // Giờ nằm cạnh section-area. Lấy hàng gần nhất có cả địa chỉ và giờ HH:mm.
    // Tìm theo định dạng giờ để vẫn phát hiện được giờ thực tế khác giờ đã chọn.
    const coCotGio = './/*[translate(normalize-space(.), "0123456789", "") = ":" '
      + 'and (string-length(normalize-space(.)) = 4 or string-length(normalize-space(.)) = 5)]';
    for (const diem of [donDaChon, traDaChon]) {
      const dongThongTin = thongTinChuyenDi.getByText(diem.ten, { exact: true }).first()
        .locator(`xpath=ancestor::div[${coCotGio}][1]`);
      await expect(dongThongTin, `Giữ đúng điểm đã chọn: ${diem.ten}`).toBeVisible();
      await expect(dongThongTin.getByText('Thay đổi', { exact: true }), 'Đối chiếu riêng từng điểm đón/trả')
        .toHaveCount(1);
      await expect(dongThongTin.getByText(/^\d{1,2}:\d{2}$/), `Giữ đúng giờ tại ${diem.ten}`)
        .toHaveText(diem.gio);
    }

    // Dừng ở trang liên hệ: TC002 không nhập thông tin hay tạo đơn/thanh toán.
    ketQua = testInfo.errors.length === 0 ? 'PASS' : 'FAIL';
  } catch (error) {
    ketQua = testInfo.expectedStatus === 'skipped' && testInfo.errors.length === 0 ? 'SKIP' : 'FAIL';
    throw error;
  } finally {
    if (!page.isClosed()) await page.screenshot({ path: anh(ketQua), fullPage: true });
  }
});

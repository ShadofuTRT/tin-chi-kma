# Tool hỗ trợ xếp lịch cho các đồng chí KMA

- Demo: [https://tin-chi-kma-fad4d.web.app/](https://tin-chi-kma-fad4d.web.app/)

## Yêu cầu hệ thống

- Node.js
- yarn: `npm i -g yarn`
- ts-node: `npm i -g ts-node`

## Chạy dự án trên local

```sh
yarn install
yarn start
```

## Cập nhật lịch học

1. Đặt file Excel thời khóa biểu tại `public/tinchi.xlsx`
2. Cấu hình `TITLE` và `SHEET_DATA` trong `src/configs/excel.ts`
3. Chuyển đổi dữ liệu:
```sh
yarn convert
yarn validate
```

## Deploy

1. Build project:
```sh
yarn build
```
2. Upload thư mục `dist` lên hosting web

---

Do mình hiện không còn hoạt động nhiều ở trường nên không có nhiều thời gian maintain cho dự án này do mục tiêu đầu tiên mình làm đó là phục vụ bản thân. Do đó nếu các bạn thấy tool hữu ích thì có thể đóng góp/cập nhật thời khóa biểu mỗi kì thông qua [merge request](https://github.com/ngosangns/tin-chi/pulls) hoặc có thể chủ động deploy lên hosting của các bạn nhé!

Cảm ơn các bạn đã ủng hộ sản phẩm!

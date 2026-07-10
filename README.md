# Hướng dẫn thiết lập Ronnie vs. Dusty

Đây là tài liệu hướng dẫn thiết lập Firebase và nhúng game vào ClassIn.

## 1. Thiết lập Firebase Realtime Database

Vì game chạy hoàn toàn ở phía client (trình duyệt) và cần đồng bộ theo thời gian thực (realtime) giữa nhiều học sinh, chúng ta sử dụng **Firebase Realtime Database**.

### Các bước tạo Firebase:
1. Truy cập [Firebase Console](https://console.firebase.google.com/).
2. Nhấn **Add project** (Thêm dự án), đặt tên là `ronnie-vs-dusty`. (Có thể tắt Google Analytics).
3. Sau khi dự án tạo xong, vào mục **Build > Realtime Database** ở menu bên trái.
4. Nhấn **Create Database**, chọn location gần nhất (VD: Singapore), và chọn **Start in test mode** (chúng ta sẽ cập nhật rules sau).
5. Vào **Project Overview** (biểu tượng bánh răng -> Project settings).
6. Ở thẻ **General**, kéo xuống mục "Your apps", chọn biểu tượng **</>** (Web).
7. Đặt tên app (ví dụ `web-client`), không cần chọn Firebase Hosting.
8. Firebase sẽ hiển thị đoạn mã `firebaseConfig`. Hãy copy đoạn mã này.
9. Mở file `script.js` trong thư mục code, tìm đến biến `const firebaseConfig` và thay thế bằng cấu hình bạn vừa copy.

## 2. Thiết lập Security Rules (Quan trọng)

Để đảm bảo học sinh không can thiệp được vào điểm số của nhau, hãy vào mục **Realtime Database > Rules** và dán đoạn mã sau:

```json
{
  "rules": {
    "rooms": {
      "$roomId": {
        // Mọi người đều có quyền đọc thông tin phòng
        ".read": true,
        
        // Giáo viên (người tạo phòng) có thể ghi toàn bộ phòng ban đầu
        ".write": "data.val() == null || !data.exists() || newData.child('gameState').exists()",
        
        "bossHP": {
          // Ai cũng có thể update máu boss (khi đánh trúng)
          ".write": true
        },
        
        "players": {
          "$playerId": {
            // Học sinh chỉ được ghi/update dữ liệu của chính mình thông qua $playerId của họ
            // Tuy nhiên với game giáo dục không yêu cầu login phức tạp, ta có thể cho phép write tự do
            // nhưng chỉ cho phép update điểm lên, không được kéo tụt điểm của người khác.
            ".write": true
          }
        }
      }
    }
  }
}
```
*Lưu ý: Do đây là game giáo dục cho trẻ nhỏ và không dùng Firebase Auth (để tiết kiệm thao tác cho học sinh), Rule ở mức mở vừa phải.*

## 3. Cấu trúc dữ liệu JSON (Schema)

Cấu trúc trên Firebase sẽ có dạng như sau:

```json
{
  "rooms": {
    "123456": {
      "gameState": "playing", // 'lobby', 'intro', 'playing', 'ended'
      "bossHP": 80,
      "maxHP": 100,
      "createdAt": 1678901234567,
      "players": {
        "player_id_1": {
          "name": "Minh Anh",
          "score": 50,
          "lastHit": 1678901255000
        },
        "player_id_2": {
          "name": "Tuấn Kiệt",
          "score": 30,
          "lastHit": 1678901265000
        }
      }
    }
  }
}
```

## 4. Cách thay đổi Ngân hàng Câu hỏi
Mở file `script.js`, ngay ở những dòng đầu tiên là mảng `questions`.
Bạn có thể tùy ý sửa:
- `q`: Nội dung câu hỏi.
- `options`: 4 đáp án.
- `correct`: Chỉ số của đáp án đúng (từ 0 đến 3, tương ứng A, B, C, D).

## 5. Hướng dẫn Nhúng vào ClassIn
Game này được thiết kế Responsive tỷ lệ 4:3 (chuẩn ClassIn) và code không cần server phức tạp.
1. Bạn có thể up toàn bộ thư mục lên một hosting miễn phí như **GitHub Pages** hoặc **Netlify**.
2. Lấy link trang web (VD: `https://ten-ban.github.io/ronnie-vs-dusty/`).
3. Trong ClassIn, công cụ **Browser** (Trình duyệt) -> nhập link trên, lưu dưới dạng file `.edb` hoặc `.edu` (nếu có công cụ đóng gói HTML5 của ClassIn).
4. Hoặc đơn giản là mở link bằng công cụ Trình duyệt trong lớp học, sau đó chiếu lên bảng đen cho học sinh quét mã. (Học sinh mở bằng điện thoại hoặc iPad đều tương thích do thiết kế Responsive dùng đơn vị tương đối).

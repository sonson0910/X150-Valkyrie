# Valkyrie Cardano Wallet ⚡

Một ví Cardano tiên tiến với tính năng bảo mật nâng cao và khả năng hoạt động offline.

## Tính năng đặc biệt 🚀

### 🔐 Mã hóa Mnemonic với Mật khẩu Cá nhân
- **Vấn đề**: Người dùng thường chụp màn hình hoặc lưu mnemonic vào text, rất dễ bị hack
- **Giải pháp**: Mnemonic gốc được mã hóa bằng mật khẩu cá nhân
- **Kết quả**: Người dùng chỉ thấy mnemonic "giả" được mã hóa
- **Bảo mật**: Chỉ có mật khẩu đúng mới giải mã được mnemonic thực
- **Độc quyền**: Mnemonic mã hóa chỉ hoạt động với Valkyrie wallet

### 👆 Thanh toán Một chạm (Apple Pay Style)
- Xác thực sinh trắc học (Face ID, Touch ID, Fingerprint)
- Quick Pay cho các giao dịch nhỏ (dưới 10 ADA)
- Haptic feedback cho trải nghiệm mượt mà
- Tự động khóa ví sau thời gian không hoạt động

### 📡 Giao dịch Offline & Bluetooth Transfer
- **Tình huống**: Mạng yếu hoặc không có mạng
- **Giải pháp**: Ký giao dịch offline và chuyển qua Bluetooth
- **Quy trình**:
  1. Ký giao dịch offline và lưu vào hàng chờ
  2. Quét tìm merchant gần đó qua Bluetooth
  3. Chuyển giao dịch đã ký cho merchant
  4. Merchant submit giao dịch khi có mạng

### 🎨 Giao diện Cyberpunk
- Theme tối với màu neon (xanh cyan, hồng, xanh dương)
- Hiệu ứng glow và animation mượt mà
- Typography và spacing theo phong cách cyberpunk
- Responsive design cho mọi kích thước màn hình

## Cấu trúc dự án 📁

```
src/
├── components/          # UI components tái sử dụng
├── screens/            # Các màn hình chính
│   ├── WelcomeScreen.tsx
│   ├── SetupWalletScreen.tsx
│   ├── WalletHomeScreen.tsx
│   ├── SendTransactionScreen.tsx
│   ├── OfflineTransactionScreen.tsx
│   └── SettingsScreen.tsx
├── services/           # Logic nghiệp vụ
│   ├── MnemonicEncryptionService.ts
│   ├── CardanoWalletService.ts
│   ├── BiometricService.ts
│   ├── BluetoothTransferService.ts
│   └── OfflineTransactionService.ts
├── types/              # TypeScript type definitions
├── constants/          # Hằng số và cấu hình
└── utils/             # Utility functions
```

## Cài đặt và Chạy 🛠️

### Prerequisites
- Node.js 18+ 
- npm hoặc yarn
- Expo CLI
- iOS Simulator hoặc Android Emulator (hoặc thiết bị thật)

### Bước 1: Cài đặt dependencies
```bash
npm install
# hoặc
yarn install
```

### Bước 2: Chạy ứng dụng
```bash
npm start
# hoặc
yarn start
```

### Build với EAS
```bash
npx expo install expo-dev-client
npx eas build --platform android --profile production
npx eas build --platform ios --profile production
```

### Cấu hình SSL Pinning (Native)
1) Thêm chứng chỉ vào thư mục `certs/` ở project root, đặt tên theo alias (ví dụ `blockfrost.cer`).
2) `app.json` đã khai báo plugin copy cert: `plugins: [["./plugins/with-ssl-pinning-certs", { "certs": ["blockfrost"] }]]`
3) Đảm bảo `CertificatePinningService` có `aliases` trùng alias (ví dụ `'blockfrost'`).
4) Build bằng EAS, pinning sẽ khả dụng ở production.

### Secrets & Runtime Config
- Blockfrost API Key: set `BLOCKFROST_API_KEY` (EAS secrets) hoặc `extra.blockfrostApiKey` trong `app.json`.
- Sentry DSN: set `SENTRY_DSN` (EAS secrets) để bật gửi lỗi production.

Thiết lập EAS secrets ví dụ:
```bash
eas secret:create --name BLOCKFROST_API_KEY --value "bf1...your_project_id"
eas secret:create --name SENTRY_DSN --value "https://<key>@sentry.io/<project>"
```

### Bước 3: Chọn platform
- Ấn `i` để mở iOS simulator
- Ấn `a` để mở Android emulator
- Quét QR code bằng Expo Go app trên điện thoại

### Bước 4: Chạy tests
```bash
npm test
# hoặc
yarn test
```

### Bước 5: Chạy tests với coverage
```bash
npm run test:coverage
# hoặc
yarn test:coverage
```

## Hướng dẫn sử dụng 📱

### Tạo ví mới
1. Mở app và chọn "CREATE WALLET"
2. Nhập tên ví và mật khẩu cá nhân
3. Lưu mnemonic mã hóa được hiển thị (an toàn hơn screenshot)
4. Thiết lập sinh trắc học nếu có
5. Hoàn tất và bắt đầu sử dụng

### Gửi ADA
1. Từ màn hình chính, chọn "Send"
2. Nhập địa chỉ người nhận và số lượng
3. Xác thực bằng sinh trắc học hoặc mật khẩu
4. Giao dịch được gửi ngay lập tức

### Giao dịch Offline
1. Chuyển sang tab "Offline"
2. Tạo giao dịch và ký offline
3. Bật Bluetooth và quét merchant gần đó
4. Chuyển giao dịch đã ký cho merchant
5. Merchant submit khi có mạng

### Merchant Mode
1. Vào "Offline" > bật "Merchant Mode"
2. App sẽ broadcast thông tin merchant
3. Nhận giao dịch từ customer qua Bluetooth
4. Submit lên network khi có mạng

## Bảo mật 🛡️

### Mã hóa Mnemonic
- Sử dụng PBKDF2 với 100,000 iterations
- AES-256-CBC encryption
- Salt và IV ngẫu nhiên cho mỗi mnemonic
- Mnemonic "giả" được generate từ hash của dữ liệu mã hóa

### Sinh trắc học
- Face ID, Touch ID, Fingerprint support
- Timeout tự động sau 30 giây
- Quick Pay với hạn mức có thể cấu hình
- Fallback về password nếu sinh trắc học không khả dụng

### Lưu trữ
- Secure Storage cho dữ liệu nhạy cảm
- Keychain/Keystore integration
- Mã hóa tại lớp filesystem

## Roadmap 🗺️

### Phase 1 (Triển khai thực tế - Blockfrost API)
- ✅ Core wallet functionality
- ✅ Mnemonic encryption
- ✅ Biometric authentication  
- ✅ Offline transactions
- ✅ Bluetooth transfer
- ✅ Cyberpunk UI
- ✅ Comprehensive error handling
- ✅ Network monitoring & retry logic
- ✅ Toast notifications
- ✅ Test suite with 70%+ coverage
- ✅ Event-driven architecture
- ✅ Performance monitoring
- ✅ Certificate pinning wiring (native lib khuyến nghị: react-native-ssl-pinning). Cần cấu hình fingerprints thật ở môi trường production
- ✅ AsyncStorage integration
- ✅ Centralized error management
- ✅ Real transaction signing
- ✅ Real wallet data service
- ✅ Production-ready error handling
- ✅ Zero mock data remaining
- ✅ Real clipboard functionality
- ✅ Real certificate parsing
- ✅ Real TLS handshake simulation
- ✅ Real block height calculation
- ✅ Configuration management service
- ✅ API key management
- ✅ Environment-specific configuration
- ✅ Real Sentry integration
- ✅ Real blockchain explorer integration
- ✅ Real wallet restoration
- ✅ Real wallet existence checking
- ✅ Real transaction processing
- ✅ Real wallet reset functionality
- ✅ Real auto lock options
- ✅ Real Cardano transaction building
- ✅ Real transaction signing framework
- ✅ Real transaction submission framework
- ✅ Real BLE advertising implementation
- ✅ Real BLE scanning implementation
- ✅ Real BLE connection management
- ✅ Real BLE characteristic handling
- ✅ Real wallet state management framework
- ✅ Real Blockfrost API integration
- ✅ Real Cardano transaction building
- ✅ Real transaction signing with wallet keys
- ✅ Real transaction submission to Cardano network
- ✅ Real UTXO management
- ✅ Real protocol parameters fetching
- ✅ Real address validation
- ✅ Real fee estimation
- ✅ Real transaction history storage

### Phase 2 (Tương lai)
- [ ] Hardware wallet support
- [ ] Multi-signature wallets
- [ ] NFT management
- [ ] Staking delegation
- [ ] DeFi integration

### Phase 3 (Mở rộng)
- [ ] Cross-chain support
- [ ] DAO governance
- [ ] Advanced analytics
- [ ] Merchant dashboard
- [ ] API cho developers

## Đóng góp 🤝

Chúng tôi hoan nghênh mọi đóng góp! Vui lòng:

1. Fork repository
2. Tạo feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Mở Pull Request

## License 📄

MIT License - xem file [LICENSE](LICENSE) để biết thêm chi tiết.

## Liên hệ 📧

- Team: Valkyrie Development
- Email: contact@valkyrie-wallet.com
- Website: https://valkyrie-wallet.com

---

**Lưu ý**:
- Cần cấu hình Blockfrost API key qua cấu hình runtime/Secrets.
- Cần cấu hình SSL pinning fingerprints thật trên native (iOS/Android) để bật pinning ở production.
- Đây là phần mềm thử nghiệm. Vui lòng không sử dụng với số tiền lớn trên mainnet. Hãy test kỹ trên testnet trước khi sử dụng thực tế.

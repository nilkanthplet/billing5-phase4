# NO WERE TECH - Centering Plates Rental System

A comprehensive rental management system for centering plates with both web and mobile applications.

## Features

- **Multi-platform**: Web app and React Native mobile app
- **Gujarati-first**: Native Gujarati language support
- **Role-based access**: Admin and view-only user roles
- **Rental management**: Issue and return plate challans
- **Client management**: Comprehensive client database
- **Stock tracking**: Real-time inventory management
- **Ledger system**: Complete transaction history
- **Bill management**: Billing and payment tracking
- **PDF/JPG generation**: Downloadable challans and reports

## Tech Stack

### Web Application
- React 18 with TypeScript
- Tailwind CSS for styling
- Supabase for backend and database
- React Router for navigation
- Framer Motion for animations

### Mobile Application
- React Native
- React Navigation
- React Native Vector Icons
- Capacitor for hybrid app features

## Getting Started

### Web Development
```bash
npm install
npm run dev
```

### Mobile Development
```bash
# Install dependencies
npm install

# Build for mobile
npm run build:mobile

# Sync with Capacitor
npm run mobile:sync

# Run on Android
npm run mobile:run:android

# Run on iOS
npm run mobile:run:ios
```

## Project Structure

```
src/
├── components/          # Web React components
├── native/             # React Native components and screens
│   ├── screens/        # React Native screens
│   ├── components/     # React Native components
│   ├── navigation/     # Navigation setup
│   └── utils/          # Native utilities
├── hooks/              # Shared React hooks
├── lib/                # Supabase client and types
├── utils/              # Utility functions
└── contexts/           # React contexts
```

## Database Schema

The application uses Supabase with the following main tables:
- `clients` - Customer information
- `stock` - Plate inventory
- `challans` - Issue challans (udhar)
- `challan_items` - Line items for issue challans
- `returns` - Return challans (jama)
- `return_line_items` - Line items for return challans
- `bills` - Billing information

## User Roles

- **Admin** (nilkanthplatdepo@gmail.com): Full access to all features
- **View-only users**: Read-only access to data

## Mobile App Features

- Native mobile experience with React Native
- Offline capability with local storage
- Push notifications for important updates
- Haptic feedback for better UX
- Optimized for construction site usage

## Deployment

### Web App
The web application can be deployed to any static hosting service or built as a PWA.

### Mobile App
- **Android**: Build APK using Capacitor
- **iOS**: Build IPA using Capacitor and Xcode
- **Hybrid**: Deploy as PWA with mobile-optimized UI

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test on both web and mobile
5. Submit a pull request

## License

Private project for NO WERE TECH.
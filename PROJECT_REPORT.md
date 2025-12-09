# Project Report: Smart Cafe Ordering System

## 1. Aim
To develop a responsive, full-stack web application that digitizes the cafe ordering workflow, enabling customers to order directly from their devices and providing kitchen staff with a real-time management dashboard to streamline operations and reduce wait times.

## 2. Summary
This project is a Smart Cafe Ordering System featuring a dual-interface web application for customers and kitchen staff. It solves the problem of long queues and manual errors by allowing users to place orders via a visually rich, mobile-friendly digital menu. Authentication is handled securely through Google OAuth and OTP-based Telegram login. The system uses a modern React tech stack with real-time browser notifications to keep customers updated on their order status (Placed, Preparing, Ready). A kitchen dashboard allows staff to view incoming orders instantly and manage them through a lifecycle pipeline. By leveraging a concurrent frontend-backend architecture, the app ensures seamless data flow and high responsiveness. The solution improves operational efficiency, enhances user experience, and provides a scalable foundation for future cafe digitization.

## 3. Problem Statement
Traditional cafe ordering systems often suffer from:
- **Inefficiency**: Manual order taking is slow and prone to errors.
- **Lack of Transparency**: Customers are unaware of their order status (Preparing vs. Ready).
- **Poor User Experience**: Physical menus can be outdated or damaged.
- **Congestion**: Long queues at the billing counter.

## 4. Proposed Solution
We developed a unified web platform with two distinct interfaces:
1.  **Customer Application**: A "Bring Your Own Device" (BYOD) web app that allows customers to view a visual menu, customize orders, and track status in real-time.
2.  **Kitchen Dashboard**: An admin interface for staff to view incoming orders, update statuses (Pending -> Preparing -> Ready -> Completed), and manage workflow.

## 5. Key Features

### 4.1 Customer-Facing Features
- **Visual Menu**: High-quality images and descriptions for all items (Tea, Snacks, Desserts), organized by category with sticky navigation (similar to Uber Eats).
- **Smart Cart**: Floating cart summary with immediate "Add/Remove" actions for seamless ordering.
- **Real-Time Notifications**: Browser notifications alert users when their order is **Placed**, **Accepted**, or **Ready for Pickup**, even if the app is in the background.
- **Authentication**: Secure login via **Google OAuth** or **Telegram** (OTP-based).

### 4.2 Kitchen/Admin Features
- **Live Order Queue**: Auto-refreshing list of active orders.
- **Status Management**: One-click status updates to inform customers instantly.
- **Sound Alerts**: Audio cues for new incoming orders (planned/enabled).

## 6. Technology Stack

- **Frontend**: 
  - **Framework**: React.js (via Vite) for blazing fast performance.
  - **UI Library**: ShadCN UI + TailwindCSS for a premium, responsive design.
  - **Icons**: Lucide React.
  - **State Management**: React Hooks (useState, useEffect).

- **Backend**:
  - **Runtime**: Node.js.
  - **Server**: Express.js (REST API).
  - **Storage**: In-Memory data structure (scalable to MongoDB).
  - **Authentication**: Passport.js (Google Strategy) & Node-Telegram-Bot-API.

## 7. Implementation Highlights

- **Concurrent Architecture**: The development environment uses `concurrently` to run both the specific frontend build pipeline and the backend server simultaneously.
- **Robust Notification System**: Leverages the native Browser Notification API to bridge the gap between web apps and native push notifications.
- **Responsive Design**: The UI adapts fluidly from mobile screens to desktop monitors, ensuring specific optimizations for touch interactions.
- **Cross-Origin Resource Sharing (CORS)**: Securely configured to allow communication between the distinct frontend and backend origins.

## 8. Future Scope
- **Payment Integration**: Razorpay/Stripe integration for online payments.
- **Analytics Dashboard**: Sales reports and peak hour analysis.
- **AI Recommendations**: Personalized menu suggestions based on order history.

## 9. Conclusion
The Smart Cafe Ordering System successfully demonstrates how modern web technologies can solve real-world operational inefficiencies. It provides a scalable, user-friendly foundation for any food and beverage business looking to digitize their workflow.

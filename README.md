# WatcherMan

WatcherMan is a real-time website monitoring system built with Next.js and Supabase that helps you track the uptime, latency, and status of multiple websites simultaneously.

## Features

- **Real-time Monitoring**: Track website status and performance in real-time
- **Custom Monitoring Intervals**: Set different monitoring frequencies for each website
- **Interactive Dashboard**: View detailed performance metrics and status history
- **Data Visualization**: 
  - Real-time latency graphs
  - Status indicators with color coding
  - Historical performance data
- **Data Export**: Export monitoring data in CSV format with flexible date range selection
- **Status Classifications**:
  - UP: Website is responding normally
  - DOWN: Website is not accessible
  - DELAYED: Response time consistently exceeding threshold
  - PENDING: Initial monitoring state

## Tech Stack

- **Frontend**: Next.js with React
- **Backend**: Supabase
- **Database**: PostgreSQL (via Supabase)
- **Charts**: Recharts
- **UI Components**: shadcn/ui
- **Icons**: Lucide React
- **Date Handling**: date-fns

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Supabase account and project

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_SERVICE_ROLE=your_supabase_service_role
```

## Database Setup

Create the following tables in your Supabase database:

### website_list
```sql
create table website_list (
  address text primary key,
  freq integer not null
);
```

### website_monitoring
```sql
create table website_monitoring (
  id bigint primary key generated always as identity,
  address text not null,
  status text not null,
  message text,
  lastChecked timestamp with time zone not null,
  latency double precision,
  created_at timestamp with time zone default timezone('utc'::text, now())
);
```

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/watcherman.git
cd watcherman
```

2. Install dependencies:
```bash
npm install
# or
yarn install
```

3. Start the development server:
```bash
npm run dev
# or
yarn dev
```

4. Start the monitoring service:
```bash
node monitor.js
```

## Usage

1. Access the dashboard at `http://localhost:3000`
2. Add websites to monitor by entering their URLs
3. View real-time status updates and performance metrics
4. Export monitoring data as needed

## Key Components

- **Home Component**: Main dashboard interface (`Home.tsx`)
- **DataExportModal**: Handles data export functionality (`DataExportModal.tsx`)
- **WebsiteMonitor**: Core monitoring logic (`monitor.js`)

## Monitoring Service

The monitoring service runs independently and:
- Performs regular health checks on registered websites
- Updates status and metrics in real-time
- Handles connection timeouts and errors
- Manages monitoring frequencies per website
- Provides real-time updates via Supabase subscriptions

## License

This project is open source and available under the [MIT License](LICENSE).

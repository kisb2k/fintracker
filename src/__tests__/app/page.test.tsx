import { render, screen, waitFor } from '@testing-library/react';
import DashboardPage from '@/app/page';

// Mock the database operations
jest.mock('@/lib/db', () => ({
  getDb: jest.fn().mockResolvedValue({
    all: jest.fn().mockResolvedValue([]),
    run: jest.fn().mockResolvedValue(undefined),
  }),
}));

describe('DashboardPage', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  test('renders dashboard page', async () => {
    render(<DashboardPage />);
    
    // Wait for the loading state to finish
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    // Check for main dashboard elements
    expect(screen.getByRole('heading', { name: /dashboard/i })).toBeInTheDocument();
  });

  test('shows loading state initially', () => {
    render(<DashboardPage />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  test('displays accounts section', async () => {
    render(<DashboardPage />);
    
    await waitFor(() => {
      expect(screen.getByText('Accounts')).toBeInTheDocument();
    });
  });

  test('displays transactions section', async () => {
    render(<DashboardPage />);
    
    await waitFor(() => {
      expect(screen.getByText('Recent Transactions')).toBeInTheDocument();
    });
  });

  test('displays budget section', async () => {
    render(<DashboardPage />);
    
    await waitFor(() => {
      expect(screen.getByText('Budget Overview')).toBeInTheDocument();
    });
  });
}); 
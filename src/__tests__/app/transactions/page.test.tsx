import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import TransactionsPage from '@/app/transactions/page';

// Mock the database operations
jest.mock('@/lib/db', () => ({
  getDb: jest.fn().mockResolvedValue({
    all: jest.fn().mockResolvedValue([]),
    run: jest.fn().mockResolvedValue(undefined),
  }),
}));

describe('TransactionsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders transactions page', async () => {
    render(<TransactionsPage />);
    
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    expect(screen.getByRole('heading', { name: /transactions/i })).toBeInTheDocument();
  });

  test('shows loading state initially', () => {
    render(<TransactionsPage />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  test('displays add transaction button', async () => {
    render(<TransactionsPage />);
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /add transaction/i })).toBeInTheDocument();
    });
  });

  test('displays upload transactions button', async () => {
    render(<TransactionsPage />);
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /upload transactions/i })).toBeInTheDocument();
    });
  });

  test('opens add transaction dialog when button is clicked', async () => {
    render(<TransactionsPage />);
    
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    const addButton = screen.getByRole('button', { name: /add transaction/i });
    fireEvent.click(addButton);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Add New Transaction')).toBeInTheDocument();
  });

  test('opens upload transactions dialog when button is clicked', async () => {
    render(<TransactionsPage />);
    
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    const uploadButton = screen.getByRole('button', { name: /upload transactions/i });
    fireEvent.click(uploadButton);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Upload Transactions')).toBeInTheDocument();
  });
}); 
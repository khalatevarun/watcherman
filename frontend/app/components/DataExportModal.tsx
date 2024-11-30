import React, { useState, useEffect } from 'react';
import { Download, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { SupabaseClient } from '@supabase/supabase-js';
import Button from './Button';

interface DataExportModalProps {
  supabase: SupabaseClient;
  activeUrl: string;
}

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
}

interface WebsiteMonitoring {
  id: number;
  lastChecked: string;
  address: string;
  status: string;
  message: string;
  latency: number;
  [key: string]: any; // For any additional fields
}

const DataExportModal: React.FC<DataExportModalProps> = ({ supabase, activeUrl }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [exportOption, setExportOption] = useState<'complete' | 'dateRange' | null>(null);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [recordCount, setRecordCount] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [showStartCalendar, setShowStartCalendar] = useState(false);
  const [showEndCalendar, setShowEndCalendar] = useState(false);
  const [calendarDate, setCalendarDate] = useState(new Date());

  console.log('activeUrl:', activeUrl);


  const formatCSVData = (data: any[]) => {
    // Define column mapping (old name -> new name)
    const columnMapping: { [key: string]: string } = {
      lastChecked: 'Timestamp',
      latency: 'Latency (ms)',
      status: 'Status',
      message: 'Message',
    };

    // Get headers we want to include (excluding 'id' and any other unwanted columns)
    const wantedColumns = ['lastChecked','latency', 'status', 'message'];
    const headers = wantedColumns.map(col => columnMapping[col]);

    // Format rows
    const rows = data.map(row => {
      return wantedColumns.map(col => {
        if (col === 'lastChecked') {
          // Convert timestamp to local timezone
          return `"${new Date(row[col]).toLocaleString()}"`;
        }
        // For other columns, handle string escaping
        return typeof row[col] === 'string' ? `"${row[col].replace(/"/g, '""')}"` : row[col];
      });
    });

    return [headers, ...rows].join('\n');
  };

  // Function to generate calendar dates
  const generateCalendarDays = (year: number, month: number): CalendarDay[] => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days: CalendarDay[] = [];
    
    // Add previous month's days
    const firstDayOfWeek = firstDay.getDay();
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const day = new Date(year, month, -i);
      days.push({ date: day, isCurrentMonth: false });
    }
    
    // Add current month's days
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const day = new Date(year, month, i);
      days.push({ date: day, isCurrentMonth: true });
    }
    
    return days;
  };

  // Function to validate and update dates
  const handleDateSelect = (date: Date, isStart: boolean): void => {
    if (isStart) {
      setStartDate(date);
      setShowStartCalendar(false);
      if (endDate && date > endDate) {
        setEndDate(date);
      }
    } else {
      if (startDate && date < startDate) {
        setError('End date cannot be before start date');
        return;
      }
      setEndDate(date);
      setShowEndCalendar(false);
    }
    setError('');
  };

  // Fetch record count when dates change
  useEffect(() => {
    const fetchRecordCount = async (): Promise<void> => {
      try {
        let query = supabase
          .from('website_monitoring')
          .select('id', { count: 'exact' })
          .eq('address', activeUrl); // Always filter by activeUrl;

        if (startDate) {
          query = query.gte('lastChecked', format(startDate, "yyyy-MM-dd'T'00:00:00'Z'"));
        }
        if (endDate) {
          query = query.lte('lastChecked', format(endDate, "yyyy-MM-dd'T'23:59:59'Z'"));
        }

        const { count, error } = await query;
        
        if (error) throw error;
        setRecordCount(count);
      } catch (err) {
        setError('Error fetching record count');
        console.error(err);
      }
    };

    if (startDate && endDate) {
      fetchRecordCount();
    } else {
      setRecordCount(null);
    }
  }, [startDate, endDate]);

// Update the existing downloadCSV function to use the new formatCSVData
const downloadCSV = async (): Promise<void> => {
  try {
    setIsLoading(true);
    setError('');

    // Get filtered count first
    let countQuery = supabase
      .from('website_monitoring')
      .select('*', { count: 'exact', head: true })
      .eq('address', activeUrl); // Always filter by activeUrl;

    if (startDate) {
      countQuery = countQuery.gte('lastChecked', format(startDate, "yyyy-MM-dd'T'00:00:00'Z'"));
    }
    if (endDate) {
      countQuery = countQuery.lte('lastChecked', format(endDate, "yyyy-MM-dd'T'23:59:59'Z'"));
    }

    const { count } = await countQuery;
    if (!count) throw new Error('No data available');

    // Calculate number of pages needed
    const pageSize = 1000;
    const pages = Math.ceil(count / pageSize);
    let allData: any[] = [];

    // Fetch data page by page
    for (let i = 0; i < pages; i++) {
      let query = supabase
        .from('website_monitoring')
        .select('*')
        .eq('address', activeUrl) // Always filter by activeUrl
        .order('lastChecked', { ascending: true })
        .range(i * pageSize, (i + 1) * pageSize - 1);

      if (startDate) {
        query = query.gte('lastChecked', format(startDate, "yyyy-MM-dd'T'00:00:00'Z'"));
      }
      if (endDate) {
        query = query.lte('lastChecked', format(endDate, "yyyy-MM-dd'T'23:59:59'Z'"));
      }

      const { data, error } = await query;
      if (error) throw error;
      if (!data) continue;

      allData = [...allData, ...data];
    }

    if (allData.length === 0) throw new Error('No data received');

    const csvContent = formatCSVData(allData);
    
    // Create and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    const fileName = startDate && endDate
      ? `${activeUrl}_tracking_data_${format(startDate, 'yyyy-MM-dd')}_to_${format(endDate, 'yyyy-MM-dd')}.csv`
      : `${activeUrl}_tracking_data_${format(new Date(), 'yyyy-MM-dd')}.csv`;

    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setIsOpen(false);
  } catch (err) {
    setError(`Error downloading data: ${err instanceof Error ? err.message : 'Unknown error'}`);
  } finally {
    setIsLoading(false);
  }
};

const downloadCompleteReport = async (): Promise<void> => {
  try {
    setIsLoading(true);
    setError('');

    // Get total count first
    const { count } = await supabase
      .from('website_monitoring')
      .select('*', { count: 'exact', head: true })
      .eq('address', activeUrl); // Always filter by activeUrl;

    if (!count) throw new Error('No data available');

    // Calculate number of pages needed (assuming 1000 per page)
    const pageSize = 1000;
    const pages = Math.ceil(count / pageSize);
    let allData: any[] = [];

    // Fetch data page by page
    for (let i = 0; i < pages; i++) {
      const { data, error } = await supabase
        .from('website_monitoring')
        .select('*')
        .eq('address', activeUrl) // Always filter by activeUrl
        .order('lastChecked', { ascending: true })
        .range(i * pageSize, (i + 1) * pageSize - 1);

      if (error) throw error;
      if (!data) continue;

      allData = [...allData, ...data];
    }

    if (allData.length === 0) throw new Error('No data received');

    const csvContent = formatCSVData(allData);
    
    // Create and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    const fileName = `${activeUrl}_complete_tracking_data_${format(new Date(), 'yyyy-MM-dd')}.csv`;

    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setIsOpen(false);
  } catch (err) {
    setError(`Error downloading data: ${err instanceof Error ? err.message : 'Unknown error'}`);
  } finally {
    setIsLoading(false);
  }
};

  const weekDays: string[] = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  const resetState = () => {
    setExportOption(null);
    setStartDate(null);
    setEndDate(null);
    setShowStartCalendar(false);
    setShowEndCalendar(false);
    setError('');
  };

  const handleModalClose = () => {
    setIsOpen(false);
    resetState();
  };

  const handleOptionSelect = (option: 'complete' | 'dateRange') => {
    setExportOption(option);
    setError('');
  };

  return (
   <>
    <Button 
      onClick={() => setIsOpen(true)}
      isLoading={false}
      icon={<Download className="w-4 h-4" />}
      defaultText='Export Data'
    />
    {isOpen && (
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex items-start justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
          <div 
            className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" 
            onClick={() => setIsOpen(false)}
          />

          <div className="relative inline-block text-left align-bottom transition-all transform bg-white rounded-lg shadow-xl sm:my-8 sm:max-w-lg sm:w-full">
            <div className="px-4 pt-5 pb-4 sm:p-6">
              <div className="w-full">
                <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">
                  Export Tracking Data
                </h3>

                <div className="space-y-4">
                  {/* Export Options */}
                  <div className="flex flex-col gap-3">
                    <button
                      type="button"
                      onClick={()=>handleOptionSelect('complete')}
                      className={`flex items-center justify-between p-4 border rounded-lg text-left ${
                        exportOption === 'complete' 
                          ? 'border-blue-500 bg-blue-50' 
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <div>
                        <h4 className="font-medium text-gray-900">Complete History</h4>
                        <p className="text-sm text-gray-500">Export all tracking data from the beginning</p>
                      </div>
                      {exportOption === 'complete' && (
                        <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOptionSelect('dateRange')}
                      className={`flex items-center justify-between p-4 border rounded-lg text-left ${
                        exportOption === 'dateRange' 
                          ? 'border-blue-500 bg-blue-50' 
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <div>
                        <h4 className="font-medium text-gray-900">Custom Date Range</h4>
                        <p className="text-sm text-gray-500">Select a specific time period to export</p>
                      </div>
                      {exportOption === 'dateRange' && (
                        <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
                      )}
                    </button>
                  </div>

                  {/* Date Range Selectors */}
                  {exportOption === 'dateRange' && (
                    <div className="mt-4 space-y-4">
                      {/* Start Date Picker */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Start Date
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setShowStartCalendar(!showStartCalendar);
                            setShowEndCalendar(false);
                          }}
                          className="w-full flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-left text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                          {startDate ? format(startDate, 'PPP') : 'Pick a date'}
                        </button>
                        
                        {showStartCalendar && (
                          <div className="mt-2 bg-white rounded-md border">
                            <div className="p-2">
                              <div className="flex justify-between items-center mb-2">
                                <button
                                  type="button"
                                  onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1))}
                                  className="p-1 hover:bg-gray-100 rounded"
                                >
                                  ←
                                </button>
                                <span className="text-sm font-medium">
                                  {format(calendarDate, 'MMMM yyyy')}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1))}
                                  className="p-1 hover:bg-gray-100 rounded"
                                >
                                  →
                                </button>
                              </div>
                              <div className="grid grid-cols-7 gap-1">
                                {weekDays.map(day => (
                                  <div key={day} className="text-center text-xs text-gray-500 py-1">
                                    {day}
                                  </div>
                                ))}
                                {generateCalendarDays(calendarDate.getFullYear(), calendarDate.getMonth()).map((day, index) => (
                                  <button
                                    key={index}
                                    type="button"
                                    onClick={() => handleDateSelect(day.date, true)}
                                    className={`p-1 text-sm rounded hover:bg-blue-50 ${
                                      day.isCurrentMonth ? 'text-gray-900' : 'text-gray-400'
                                    } ${
                                      startDate && format(day.date, 'yyyy-MM-dd') === format(startDate, 'yyyy-MM-dd')
                                        ? 'bg-blue-100'
                                        : ''
                                    }`}
                                  >
                                    {format(day.date, 'd')}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* End Date Picker */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          End Date
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setShowEndCalendar(!showEndCalendar);
                            setShowStartCalendar(false);
                          }}
                          className="w-full flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-left text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                          {endDate ? format(endDate, 'PPP') : 'Pick a date'}
                        </button>

                        {showEndCalendar && (
                          <div className="mt-2 bg-white rounded-md border">
                            <div className="p-2">
                              <div className="flex justify-between items-center mb-2">
                                <button
                                  type="button"
                                  onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1))}
                                  className="p-1 hover:bg-gray-100 rounded"
                                >
                                  ←
                                </button>
                                <span className="text-sm font-medium">
                                  {format(calendarDate, 'MMMM yyyy')}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1))}
                                  className="p-1 hover:bg-gray-100 rounded"
                                >
                                  →
                                </button>
                              </div>
                              <div className="grid grid-cols-7 gap-1">
                                {weekDays.map(day => (
                                  <div key={day} className="text-center text-xs text-gray-500 py-1">
                                    {day}
                                  </div>
                                ))}
                                {generateCalendarDays(calendarDate.getFullYear(), calendarDate.getMonth()).map((day, index) => (
                                  <button
                                    key={index}
                                    type="button"
                                    onClick={() => handleDateSelect(day.date, false)}
                                    className={`p-1 text-sm rounded hover:bg-blue-50 ${
                                      day.isCurrentMonth ? 'text-gray-900' : 'text-gray-400'
                                    } ${
                                      endDate && format(day.date, 'yyyy-MM-dd') === format(endDate, 'yyyy-MM-dd')
                                        ? 'bg-blue-100'
                                        : ''
                                    }`}
                                  >
                                    {format(day.date, 'd')}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {recordCount !== null && (
                    <div className="text-sm text-gray-600">
                      {recordCount} records will be exported
                    </div>
                  )}

                  {error && (
                    <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md">
                      {error}
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse gap-2">
                    
                    <Button 
                      onClick={exportOption === 'complete' ? downloadCompleteReport : downloadCSV}
                      disabled={isLoading || (exportOption === 'dateRange' && (!startDate || !endDate)) || !exportOption}
                      icon={<Download className="w-4 h-4" />}
                      isLoading={isLoading}
                      loadingText='Downloading...'
                      defaultText='Download'
                    />   
                    <button
                      type="button"
                      onClick={handleModalClose}
                      className="inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )}
  </>
  );
};

export default DataExportModal;
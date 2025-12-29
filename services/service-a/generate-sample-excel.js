const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

const sampleData = [
  {
    id: 1,
    name: 'John Doe',
    email: 'john.doe@example.com',
    age: 30,
    city: 'New York',
    active: true,
    salary: 75000,
  },
  {
    id: 2,
    name: 'Jane Smith',
    email: 'jane.smith@example.com',
    age: 28,
    city: 'Los Angeles',
    active: true,
    salary: 82000,
  },
  {
    id: 3,
    name: 'Bob Johnson',
    email: 'bob.johnson@example.com',
    age: 35,
    city: 'Chicago',
    active: false,
    salary: 68000,
  },
  {
    id: 4,
    name: 'Alice Williams',
    email: 'alice.williams@example.com',
    age: 32,
    city: 'Houston',
    active: true,
    salary: 91000,
  },
  {
    id: 5,
    name: 'Charlie Brown',
    email: 'charlie.brown@example.com',
    age: 29,
    city: 'Phoenix',
    active: true,
    salary: 72000,
  },
  {
    id: 6,
    name: 'Diana Prince',
    email: 'diana.prince@example.com',
    age: 27,
    city: 'Philadelphia',
    active: true,
    salary: 88000,
  },
  {
    id: 7,
    name: 'Edward Wilson',
    email: 'edward.wilson@example.com',
    age: 41,
    city: 'San Antonio',
    active: false,
    salary: 95000,
  },
  {
    id: 8,
    name: 'Fiona Davis',
    email: 'fiona.davis@example.com',
    age: 26,
    city: 'San Diego',
    active: true,
    salary: 79000,
  },
];

async function generateSampleExcel() {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Data');
  
  const allKeys = new Set();
  sampleData.forEach((item) => {
    Object.keys(item).forEach((key) => allKeys.add(key));
  });

  const headers = Array.from(allKeys);

  worksheet.columns = headers.map((header) => ({
    header: header.charAt(0).toUpperCase() + header.slice(1),
    key: header,
    width: 20,
  }));

  sampleData.forEach((item) => {
    const row = {};
    headers.forEach((header) => {
      row[header] = item[header];
    });
    worksheet.addRow(row);
  });

  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' },
  };

  const uploadsDir = path.join(__dirname, 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const filename = 'sample-data.xlsx';
  const filepath = path.join(uploadsDir, filename);
  await workbook.xlsx.writeFile(filepath);
}

generateSampleExcel().catch((error) => {
  console.error(error);
  process.exit(1);
});


// pages/DashboardIndex.tsx
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { Package, ShoppingCart, Users, TrendingUp, Archive } from 'lucide-react';

const statCards = [
  { title: 'Products', value: 1280, icon: <Package size={20} />, color: 'bg-blue-100 text-blue-600' },
  { title: 'Orders', value: 745, icon: <ShoppingCart size={20} />, color: 'bg-green-100 text-green-600' },
  { title: 'Customers', value: 512, icon: <Users size={20} />, color: 'bg-yellow-100 text-yellow-600' },
  { title: 'Revenue', value: '$24.5k', icon: <TrendingUp size={20} />, color: 'bg-indigo-100 text-indigo-600' },
  { title: 'Stock', value: 980, icon: <Archive size={20} />, color: 'bg-pink-100 text-pink-600' },
];

const chartData = [
  { name: 'Jan', value: 400 },
  { name: 'Feb', value: 600 },
  { name: 'Mar', value: 800 },
  { name: 'Apr', value: 700 },
  { name: 'May', value: 1000 },
  { name: 'Jun', value: 1200 },
  { name: 'Jul', value: 900 },
];

const transactions = [
  { id: '#001', customer: 'Alice', amount: '$120', status: 'Completed' },
  { id: '#002', customer: 'Bob', amount: '$90', status: 'Pending' },
  { id: '#003', customer: 'Charlie', amount: '$200', status: 'Completed' },
  { id: '#004', customer: 'Daisy', amount: '$150', status: 'Pending' },
];

const tasks = [
  { task: 'Prepare monthly report', status: 'In Progress' },
  { task: 'Update stock database', status: 'Pending' },
  { task: 'Review orders', status: 'Completed' },
];

const DashboardIndex = () => {
  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {statCards.map((card) => (
          <div
            key={card.title}
            className="flex items-center p-4 bg-card rounded-xl shadow-sm hover:shadow-md transition-shadow"
          >
            <div className={`p-3 rounded-lg flex items-center justify-center mr-4 ${card.color}`}>
              {card.icon}
            </div>
            <div>
              <p className="text-muted-foreground text-sm">{card.title}</p>
              <p className="text-xl font-semibold">{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Chart */}
        <div className="bg-card p-4 rounded-xl shadow-sm hover:shadow-md transition-shadow w-full">
          <h2 className="text-lg font-medium mb-4">Monthly Revenue</h2>
          <div className="w-full h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip />
                <Line type="monotone" dataKey="value" stroke="#0ea5e9" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Today's Tasks */}
        <div className="bg-card p-4 rounded-xl shadow-sm hover:shadow-md transition-shadow w-full">
          <h2 className="text-lg font-medium mb-4">Today's Tasks</h2>
          <ul className="space-y-2">
            {tasks.map((task, idx) => (
              <li
                key={idx}
                className="flex justify-between items-center p-2 border rounded-lg hover:bg-accent/10 transition"
              >
                <span>{task.task}</span>
                <span
                  className={`px-2 py-1 text-xs rounded-full font-medium ${
                    task.status === 'Completed'
                      ? 'bg-green-100 text-green-700'
                      : task.status === 'In Progress'
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {task.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-card p-4 rounded-xl shadow-sm hover:shadow-md transition-shadow w-full overflow-x-auto">
        <h2 className="text-lg font-medium mb-4">Recent Transactions</h2>
        <table className="w-full text-left table-auto border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className="py-2 px-4 text-sm text-muted-foreground">ID</th>
              <th className="py-2 px-4 text-sm text-muted-foreground">Customer</th>
              <th className="py-2 px-4 text-sm text-muted-foreground">Amount</th>
              <th className="py-2 px-4 text-sm text-muted-foreground">Status</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx) => (
              <tr key={tx.id} className="border-b border-border hover:bg-accent/10 transition">
                <td className="py-2 px-4">{tx.id}</td>
                <td className="py-2 px-4">{tx.customer}</td>
                <td className="py-2 px-4">{tx.amount}</td>
                <td className="py-2 px-4">
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      tx.status === 'Completed'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}
                  >
                    {tx.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DashboardIndex;

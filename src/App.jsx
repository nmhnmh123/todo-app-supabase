import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from './supabaseClient'
import './App.css'

function App() {
  const today = new Date().toISOString().split('T')[0];

  const [todos, setTodos] = useState([]);
  const [selectedDate, setSelectedDate] = useState(today);
  const [inputValue, setInputValue] = useState('');
  const [deadlineTime, setDeadlineTime] = useState('23:59');

  useEffect(() => {
    fetchTodos();
  }, []);

  const fetchTodos = async () => {
    const { data, error } = await supabase
      .from('todos')
      .select('*')
      .order('deadline', { ascending: true });
    
    if (error) console.error('Error fetching todos:', error);
    else setTodos(data || []);
  };

  // Lấy danh sách các ngày có công việc (Unique)
  const activeDates = [...new Set(todos.map(t => t.deadline.split('T')[0]))].sort();

  // Đếm số việc chưa xong của từng ngày
  const getUnfinishedCount = (date) => {
    return todos.filter(t => t.deadline.startsWith(date) && !t.completed).length;
  };

  const isOverdue = (deadline, completed) => {
    if (!deadline || completed) return false;
    return new Date(deadline) < new Date();
  };

  const filteredTodos = todos.filter(todo => todo.deadline.startsWith(selectedDate));

  const handleAddTodo = async (e) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const fullDeadline = `${selectedDate}T${deadlineTime}`;
    const newTodo = {
      text: inputValue,
      deadline: fullDeadline,
      completed: false,
    };

    const { data, error } = await supabase
      .from('todos')
      .insert([newTodo])
      .select();

    if (error) {
      console.error('Error adding todo:', error);
    } else {
      setTodos([...todos, ...data]);
      setInputValue('');
    }
  };

  const toggleTodo = async (id, currentStatus) => {
    const { error } = await supabase
      .from('todos')
      .update({ completed: !currentStatus })
      .eq('id', id);

    if (error) {
      console.error('Error updating todo:', error);
    } else {
      setTodos(
        todos.map((todo) =>
          todo.id === id ? { ...todo, completed: !todo.completed } : todo
        )
      );
    }
  };

  const deleteTodo = async (id) => {
    const { error } = await supabase
      .from('todos')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting todo:', error);
    } else {
      setTodos(todos.filter((todo) => todo.id !== id));
    }
  };

  const deleteDay = async () => {
    if (filteredTodos.length === 0) return;
    const confirmDelete = window.confirm(
      `Xóa toàn bộ ${filteredTodos.length} việc ngày ${selectedDate}?`
    );
    if (confirmDelete) {
      // Find IDs to delete
      const idsToDelete = filteredTodos.map(t => t.id);
      
      const { error } = await supabase
        .from('todos')
        .delete()
        .in('id', idsToDelete);

      if (error) {
        console.error('Error deleting day:', error);
      } else {
        setTodos(todos.filter(todo => !todo.deadline.startsWith(selectedDate)));
      }
    }
  };

  return (
    <div className="app-container">
      <h1>📅 Quản Lý Công Việc</h1>
      
      {/* Quick Jump Bar: Hiển thị các ngày có dữ liệu */}
      {activeDates.length > 0 && (
        <div className="quick-jump-container">
          <span className="quick-jump-label">Các ngày có việc:</span>
          <div className="quick-jump-list">
            {activeDates.map(date => {
              const count = getUnfinishedCount(date);
              const isToday = date === today;
              const isPast = date < today;
              
              return (
                <button 
                  key={date}
                  onClick={() => setSelectedDate(date)}
                  className={`date-chip ${selectedDate === date ? 'active' : ''} ${isPast && count > 0 ? 'urgent' : ''}`}
                  title={isPast && count > 0 ? "Ngày quá khứ còn việc!" : ""}
                >
                  {isToday ? "Hôm nay" : date.split('-').reverse().join('/')}
                  {count > 0 && <span className="badge">{count}</span>}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Main Date Control */}
      <div className="date-controls">
        <div className="date-picker-wrapper">
          <label>Đang xem:</label>
          <input 
            type="date" 
            value={selectedDate} 
            onChange={(e) => setSelectedDate(e.target.value)}
            className="main-date-picker"
          />
        </div>
        
        {filteredTodos.length > 0 && (
          <button onClick={deleteDay} className="delete-day-btn">
            Xóa ngày
          </button>
        )}
      </div>

      {/* Input Form - Improved Layout */}
      <form onSubmit={handleAddTodo} className="input-group">
        <div className="input-row">
          <input
            type="text"
            placeholder="Nhập nội dung công việc..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="task-input"
            autoFocus
          />
        </div>
        <div className="input-row-bottom">
           <div className="time-wrapper">
              <label>Giờ hết hạn:</label>
              <input
                type="time"
                value={deadlineTime}
                onChange={(e) => setDeadlineTime(e.target.value)}
                className="time-input"
              />
           </div>
           <button type="submit" className="add-btn">
             + Thêm vào {selectedDate === today ? 'Hôm nay' : selectedDate.split('-').reverse().join('/')}
           </button>
        </div>
      </form>

      <ul className="todo-list">
        <AnimatePresence mode='popLayout'>
          {filteredTodos.map((todo) => {
            const overdue = isOverdue(todo.deadline, todo.completed);
            return (
              <motion.li 
                key={todo.id} 
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ x: -300, opacity: 0 }}
                className={`todo-item ${overdue ? 'overdue' : ''} ${todo.completed ? 'completed' : ''}`}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                onDragEnd={(e, { offset }) => {
                  if (offset.x < -100) deleteTodo(todo.id);
                }}
              >
                <div className="todo-content">
                  <input
                    type="checkbox"
                    checked={todo.completed}
                    onChange={() => toggleTodo(todo.id, todo.completed)}
                  />
                  <div className="todo-text-group">
                    <span className="todo-text">{todo.text}</span>
                    <span className="todo-deadline">
                      🕒 {todo.deadline.split('T')[1].slice(0, 5)}
                    </span>
                  </div>
                </div>
                <div className="swipe-hint">◄ Trượt xóa</div>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
      
      {filteredTodos.length === 0 && (
        <div className="empty-state">Trống</div>
      )}
    </div>
  )
}

export default App

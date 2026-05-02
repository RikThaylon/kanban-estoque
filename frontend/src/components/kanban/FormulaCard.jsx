import React from 'react';

const FormulaCard = ({ title, value, formula, tooltip }) => {
  return (
    <div className="card p-4 hover:shadow-md transition-shadow relative group">
      <h3 className="text-sm font-semibold text-navy-600 mb-1">{title}</h3>
      <div className="text-2xl font-bold text-navy-800 mb-2">{value}</div>
      <div className="bg-surface-50 p-2 rounded text-xs text-navy-500 font-mono overflow-x-auto border border-surface-200">
        {formula}
      </div>
      
      {tooltip && (
        <div className="absolute opacity-0 group-hover:opacity-100 transition-opacity bg-navy-800 text-white text-xs rounded py-1 px-2 bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-max max-w-xs z-10 pointer-events-none">
          {tooltip}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-navy-800"></div>
        </div>
      )}
    </div>
  );
};

export default FormulaCard;

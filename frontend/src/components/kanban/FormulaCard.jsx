import React from 'react';

const FormulaCard = ({ title, value, formula, tooltip }) => {
  return (
    <div className="card p-4 transition-all relative group hover:border-steel-400">
      <h3 className="text-xs font-bold uppercase text-steel-500 mb-1">{title}</h3>
      <div className="text-2xl font-black text-steel-950 mb-2">{value}</div>
      <div className="bg-steel-900 text-white p-2 rounded-md text-xs font-mono overflow-x-auto border border-accent/35">
        {formula}
      </div>
      
      {tooltip && (
        <div className="absolute opacity-0 group-hover:opacity-100 transition-opacity bg-steel-900 text-white text-xs rounded-md py-1 px-2 bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-max max-w-xs z-10 pointer-events-none">
          {tooltip}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-steel-900"></div>
        </div>
      )}
    </div>
  );
};

export default FormulaCard;
